import { describe, it, expect, vi } from 'vitest';
import { commandData } from '../src/bot/commands/index.js';
import { transcribeAudio } from '../src/services/audio/transcription.js';

describe('Speech-to-Text Transcription Commands', () => {
  it('registers /transcribe with user app integration types and contexts', () => {
    const cmd = commandData.find(c => c.name === 'transcribe');
    expect(cmd).toBeDefined();
    expect(cmd?.integration_types).toEqual([0, 1]);
    expect(cmd?.contexts).toEqual([0, 1, 2]);
    const audioOpt = cmd?.options?.find((o: any) => o.name === 'audio');
    expect(audioOpt).toBeDefined();
    expect(audioOpt?.required).toBe(true);
  });

  it('registers Transcribe Audio context menu command with user app contexts', () => {
    const ctx = commandData.find(c => c.name === 'Transcribe Audio');
    expect(ctx).toBeDefined();
    expect(ctx?.type).toBe(3); // Message Context Menu
    expect(ctx?.integration_types).toEqual([0, 1]);
    expect(ctx?.contexts).toEqual([0, 1, 2]);
  });

  it('registers /tts with user app integration types and private option', () => {
    const cmd = commandData.find(c => c.name === 'tts');
    expect(cmd).toBeDefined();
    expect(cmd?.integration_types).toEqual([0, 1]);
    expect(cmd?.contexts).toEqual([0, 1, 2]);
    const textOpt = cmd?.options?.find((o: any) => o.name === 'text');
    expect(textOpt).toBeDefined();
    expect(textOpt?.required).toBe(true);
    const privateOpt = cmd?.options?.find((o: any) => o.name === 'private');
    expect(privateOpt).toBeDefined();
    expect(privateOpt?.required).toBe(false);
  });
});

describe('transcribeAudio service', () => {
  it('transcribes using Groq when available', async () => {
    const mockEnv: any = {
      GROQ_API_KEY: 'mock-groq-key',
    };

    // Mock Groq SDK
    vi.mock('groq-sdk', () => {
      return {
        toFile: vi.fn(async () => ({})),
        default: vi.fn().mockImplementation(() => ({
          audio: {
            transcriptions: {
              create: vi.fn(async () => ({
                text: 'Hello from voice note',
                language: 'en',
                duration: 4.5,
              })),
            },
          },
        })),
      };
    });

    const buffer = Buffer.from('fake-audio-bytes');
    const res = await transcribeAudio(buffer, 'audio/ogg', 'voice-message.ogg', mockEnv);
    expect(res.text).toBe('Hello from voice note');
    expect(res.language).toBe('en');
    expect(res.durationSeconds).toBe(5);
  });
});
