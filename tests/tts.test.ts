import { describe, expect, it } from 'vitest';
import { splitTextForTTS } from '../src/services/audio/tts.js';

describe('splitTextForTTS', () => {
  it('returns single chunk when text is short', () => {
    const text = 'Hello, how are you?';
    const chunks = splitTextForTTS(text, 180);
    expect(chunks).toEqual(['Hello, how are you?']);
  });

  it('splits long text at punctuation boundaries', () => {
    const s1 = 'This is the first sentence that is somewhat long and descriptive.';
    const s2 = 'This is the second sentence that continues the conversation with more details.';
    const s3 = 'And this is a third sentence ending the thought.';
    const full = `${s1} ${s2} ${s3}`;

    const chunks = splitTextForTTS(full, 80);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(80);
    }
  });

  it('returns empty array for empty or whitespace text', () => {
    expect(splitTextForTTS('')).toEqual([]);
    expect(splitTextForTTS('   ')).toEqual([]);
  });

  it('handles Arabic punctuation correctly', () => {
    const arText = 'مرحبا بك في البوت، نتمنى لك تجربة ممتعة ومفيدة اليوم!';
    const chunks = splitTextForTTS(arText, 30);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(30);
    }
  });
});
