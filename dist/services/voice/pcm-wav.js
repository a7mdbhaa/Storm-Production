/**
 * Converts raw 16-bit PCM audio buffer into a standard RIFF WAV buffer.
 * Default is 48000 Hz, stereo (2 channels), 16-bit depth (matching Discord's native Opus decode).
 */
export function pcmToWav(pcmBuffer, sampleRate = 48000, channels = 2, bitDepth = 16) {
    const header = Buffer.alloc(44);
    const dataLength = pcmBuffer.length;
    const byteRate = sampleRate * channels * (bitDepth / 8);
    const blockAlign = channels * (bitDepth / 8);
    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataLength, 4);
    header.write('WAVE', 8);
    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size (16 for standard PCM)
    header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitDepth, 34);
    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataLength, 40);
    return Buffer.concat([header, pcmBuffer]);
}
//# sourceMappingURL=pcm-wav.js.map