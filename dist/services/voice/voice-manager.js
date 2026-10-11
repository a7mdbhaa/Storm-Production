import { Readable } from 'stream';
import { AudioPlayerStatus, createAudioPlayer, createAudioResource, entersState, EndBehaviorType, joinVoiceChannel, VoiceConnectionStatus, } from '@discordjs/voice';
import ffmpegStatic from 'ffmpeg-static';
import PQueue from 'p-queue';
import prism from 'prism-media';
import { logger } from '../../utils/logger.js';
import { transcribeAudio } from '../audio/transcription.js';
import { generateSpeechAudio } from '../audio/tts.js';
import { pcmToWav } from './pcm-wav.js';
const ffmpegBinary = typeof ffmpegStatic === 'string' ? ffmpegStatic : ffmpegStatic?.default;
if (typeof ffmpegBinary === 'string') {
    process.env.FFMPEG_PATH = ffmpegBinary;
}
function waitForPlayback(player, maxWaitMs = 25_000) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            player.off('stateChange', onStateChange);
            player.off('error', onError);
            resolve();
        };
        const onStateChange = (_oldState, newState) => {
            if (newState.status === AudioPlayerStatus.Idle) {
                finish();
            }
        };
        const onError = (err) => {
            logger.warn({ error: err.message }, 'Voice player encountered an error during playback');
            finish();
        };
        const timer = setTimeout(finish, maxWaitMs);
        player.on('stateChange', onStateChange);
        player.on('error', onError);
    });
}
export class VoiceManager {
    sessions = new Map();
    getSession(guildId) {
        return this.sessions.get(guildId);
    }
    getAllSessions() {
        return [...this.sessions.values()];
    }
    async join(options) {
        const { channel, subtitlesChannel, primaryLang, secondaryLang, subtitlesEnabled = true, context } = options;
        const guildId = channel.guild.id;
        // If an existing session exists for this guild, cleanly leave it first
        if (this.sessions.has(guildId)) {
            this.leave(guildId);
        }
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false,
        });
        const player = createAudioPlayer();
        connection.subscribe(player);
        const session = {
            guildId,
            channelId: channel.id,
            channel,
            subtitlesChannel,
            subtitlesEnabled,
            connection,
            player,
            primaryLang,
            secondaryLang,
            isSpeaking: false,
            queue: new PQueue({ concurrency: 1 }),
            activeUsers: new Set(),
            startedAt: new Date(),
            lastActivity: new Date(),
            destroyed: false,
        };
        this.sessions.set(guildId, session);
        // Setup disconnect & destroy listeners
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
            }
            catch {
                this.leave(guildId);
            }
        });
        connection.on(VoiceConnectionStatus.Destroyed, () => {
            this.leave(guildId);
        });
        player.on('error', (err) => {
            logger.warn({ guildId, error: err.message }, 'Audio player warning');
        });
        // Listen to incoming user speech
        const receiver = connection.receiver;
        receiver.speaking.on('start', (userId) => {
            if (session.destroyed)
                return;
            if (session.isSpeaking)
                return; // Prevent bot from hearing itself or mic spillover
            if (userId === context.client.user?.id)
                return;
            if (session.activeUsers.has(userId))
                return;
            session.activeUsers.add(userId);
            const opusStream = receiver.subscribe(userId, {
                end: {
                    behavior: EndBehaviorType.AfterSilence,
                    duration: 900,
                },
            });
            const decoder = new prism.opus.Decoder({
                rate: 48000,
                channels: 2,
                frameSize: 960,
            });
            const pcmChunks = [];
            opusStream.pipe(decoder);
            decoder.on('data', (chunk) => {
                pcmChunks.push(chunk);
            });
            const cleanupUser = () => {
                session.activeUsers.delete(userId);
            };
            opusStream.on('error', (err) => {
                logger.warn({ userId, error: err.message }, 'Opus stream error');
                cleanupUser();
            });
            decoder.on('error', (err) => {
                logger.warn({ userId, error: err.message }, 'Opus decoder error');
                cleanupUser();
            });
            opusStream.on('end', () => {
                cleanupUser();
                if (session.destroyed || session.isSpeaking)
                    return;
                const pcmBuffer = Buffer.concat(pcmChunks);
                // Minimum ~400ms (76,800 bytes) and Maximum ~25s (4.8MB) to filter noise/clicks
                if (pcmBuffer.length < 76_800 || pcmBuffer.length > 4_800_000) {
                    return;
                }
                session.lastActivity = new Date();
                void session.queue.add(async () => {
                    if (session.destroyed)
                        return;
                    try {
                        const wavBuffer = pcmToWav(pcmBuffer);
                        const transcript = await transcribeAudio(wavBuffer, 'audio/wav', 'voice-utterance.wav', context.env);
                        const rawText = transcript.text?.trim();
                        if (!rawText || rawText.length < 2)
                            return;
                        // Filter out empty Whisper hallucinations on background noise
                        const cleanNorm = rawText.toLowerCase().replace(/[^a-z0-9]/g, '');
                        if (/^(thankyou|thankyouforwatching|thanksforwatching|subtitles|amaraorg|mbc|bye|you|hello)$/i.test(cleanNorm) && pcmBuffer.length < 150_000) {
                            return;
                        }
                        // Determine language routing
                        const detectedBase = (transcript.language || '').toLowerCase().split(/[-_]/)[0];
                        const pBase = session.primaryLang.code.toLowerCase().split(/[-_]/)[0];
                        const sBase = session.secondaryLang.code.toLowerCase().split(/[-_]/)[0];
                        let sourceLang = session.primaryLang;
                        let targetLang = session.secondaryLang;
                        if (detectedBase === sBase) {
                            sourceLang = session.secondaryLang;
                            targetLang = session.primaryLang;
                        }
                        else if (detectedBase === pBase) {
                            sourceLang = session.primaryLang;
                            targetLang = session.secondaryLang;
                        }
                        else {
                            // Default to translating to the secondary language
                            sourceLang = session.primaryLang;
                            targetLang = session.secondaryLang;
                        }
                        // Perform translation
                        const translationResult = await context.translation.translate({
                            text: rawText,
                            sourceLanguage: sourceLang.code,
                            targetLanguage: targetLang.code,
                        });
                        const translatedText = translationResult.translatedText?.trim();
                        if (!translatedText)
                            return;
                        // Send subtitle log if enabled
                        if (session.subtitlesEnabled && session.subtitlesChannel && 'send' in session.subtitlesChannel) {
                            try {
                                const member = session.channel.guild.members.cache.get(userId);
                                const speakerName = member?.displayName || `<@${userId}>`;
                                await session.subtitlesChannel.send({
                                    content: `🎙️ **${speakerName}** (${sourceLang.name}): ${rawText}\n🔊 **Dubbing (${targetLang.name})**: ${translatedText}`,
                                });
                            }
                            catch (subErr) {
                                logger.warn({ error: subErr.message }, 'Failed to post subtitle message');
                            }
                        }
                        // Generate TTS audio
                        const ttsAudio = await generateSpeechAudio(translatedText, targetLang.code);
                        // Play dubbing in Voice Channel
                        session.isSpeaking = true;
                        try {
                            const audioResource = createAudioResource(Readable.from(ttsAudio));
                            session.player.play(audioResource);
                            await waitForPlayback(session.player);
                        }
                        finally {
                            // 400ms cooldown to allow residual mic acoustic feedback to clear
                            await new Promise((r) => setTimeout(r, 400));
                            session.isSpeaking = false;
                        }
                    }
                    catch (procErr) {
                        logger.error({ error: procErr.message, userId }, 'Voice dubbing processing failed');
                    }
                });
            });
        });
        return session;
    }
    leave(guildId) {
        const session = this.sessions.get(guildId);
        if (!session)
            return false;
        session.destroyed = true;
        session.queue.clear();
        session.activeUsers.clear();
        try {
            session.player.stop(true);
        }
        catch {
            // player stop error ignored
        }
        try {
            session.connection.destroy();
        }
        catch {
            // connection destroy error ignored
        }
        this.sessions.delete(guildId);
        logger.info({ guildId }, 'Voice translation session closed');
        return true;
    }
}
export const voiceManager = new VoiceManager();
//# sourceMappingURL=voice-manager.js.map