import { describe, expect, it } from 'vitest';
import { pcmToWav } from '../src/services/voice/pcm-wav.js';

describe('pcmToWav', () => {
  it('creates a valid 44-byte WAV header for 48kHz 16-bit stereo PCM', () => {
    // 1 second of 48kHz 16-bit stereo PCM = 48000 * 2 channels * 2 bytes = 192000 bytes
    const dummyPcm = Buffer.alloc(192000);
    const wav = pcmToWav(dummyPcm, 48000, 2, 16);

    expect(wav.length).toBe(192000 + 44);

    // RIFF chunk descriptor
    expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(wav.readUInt32LE(4)).toBe(36 + 192000);
    expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE');

    // fmt subchunk
    expect(wav.subarray(12, 16).toString('ascii')).toBe('fmt ');
    expect(wav.readUInt32LE(16)).toBe(16); // Subchunk1Size
    expect(wav.readUInt16LE(20)).toBe(1);  // AudioFormat = PCM
    expect(wav.readUInt16LE(22)).toBe(2);  // Channels = 2
    expect(wav.readUInt32LE(24)).toBe(48000); // Sample rate = 48000
    expect(wav.readUInt32LE(28)).toBe(192000); // Byte rate = 48000 * 2 * 2
    expect(wav.readUInt16LE(32)).toBe(4);   // Block align = 2 * 2
    expect(wav.readUInt16LE(34)).toBe(16);  // Bits per sample = 16

    // data subchunk
    expect(wav.subarray(36, 40).toString('ascii')).toBe('data');
    expect(wav.readUInt32LE(40)).toBe(192000);
  });

  it('handles empty PCM buffer correctly', () => {
    const empty = Buffer.alloc(0);
    const wav = pcmToWav(empty);

    expect(wav.length).toBe(44);
    expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(wav.readUInt32LE(4)).toBe(36);
    expect(wav.readUInt32LE(40)).toBe(0);
  });
});
