import Groq, { toFile } from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import { logger } from '../../utils/logger.js';
export async function transcribeAudio(buffer, mimeType, filename, env) {
    let lastError;
    // 1. Try Groq Whisper (Ultra-fast ~300ms)
    if (env.GROQ_API_KEY) {
        try {
            const groq = new Groq({ apiKey: env.GROQ_API_KEY });
            const file = await toFile(buffer, filename || 'audio.mp3', { type: mimeType });
            const res = await groq.audio.transcriptions.create({
                file,
                model: 'whisper-large-v3',
                response_format: 'verbose_json',
            });
            const text = res.text?.trim();
            if (text) {
                return {
                    text,
                    language: res.language,
                    durationSeconds: res.duration ? Math.round(res.duration) : undefined,
                };
            }
        }
        catch (err) {
            lastError = err;
            logger.warn({ error: err instanceof Error ? err.message : 'unknown' }, 'Groq Whisper transcription failed; trying Gemini fallback');
        }
    }
    // 2. Fallback to Gemini Multimodal Audio
    const geminiKey = env.GEMINI_API_KEYS?.split(',')[0]?.trim() || env.GEMINI_API_KEY;
    if (geminiKey) {
        try {
            const ai = new GoogleGenAI({ apiKey: geminiKey });
            const cleanMime = mimeType.split(';')[0]?.trim() || 'audio/mp3';
            const response = await ai.models.generateContent({
                model: env.GEMINI_MODEL,
                contents: [
                    {
                        inlineData: {
                            mimeType: cleanMime,
                            data: buffer.toString('base64'),
                        },
                    },
                    'Transcribe the spoken audio verbatim in its original language. Output only the transcribed text without conversational filler or markdown quotes.',
                ],
            });
            const text = response.text?.trim();
            if (text) {
                return { text };
            }
        }
        catch (err) {
            lastError = err;
            logger.warn({ error: err instanceof Error ? err.message : 'unknown' }, 'Gemini audio transcription fallback failed');
        }
    }
    throw lastError instanceof Error ? lastError : new Error('No audio transcription provider available or all attempts failed.');
}
//# sourceMappingURL=transcription.js.map