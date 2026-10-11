import { logger } from '../../utils/logger.js';
/**
 * Splits text into chunks of at most maxChars (default 180),
 * respecting punctuation and sentence boundaries so speech sounds natural.
 */
export function splitTextForTTS(text, maxChars = 180) {
    const clean = text.trim();
    if (!clean)
        return [];
    if (clean.length <= maxChars)
        return [clean];
    const chunks = [];
    // Split by common sentence/phrase delimiters
    const sentences = clean.split(/(?<=[.!?؟،,\n])\s+/);
    let current = '';
    for (const sentence of sentences) {
        if (!sentence)
            continue;
        if ((current + ' ' + sentence).trim().length <= maxChars) {
            current = (current + ' ' + sentence).trim();
        }
        else {
            if (current) {
                chunks.push(current);
                current = '';
            }
            if (sentence.length <= maxChars) {
                current = sentence;
            }
            else {
                // Hard word wrap for very long phrases without punctuation
                const words = sentence.split(/\s+/);
                for (const word of words) {
                    if ((current + ' ' + word).trim().length <= maxChars) {
                        current = (current + ' ' + word).trim();
                    }
                    else {
                        if (current)
                            chunks.push(current);
                        current = word.slice(0, maxChars);
                    }
                }
            }
        }
    }
    if (current) {
        chunks.push(current);
    }
    return chunks.length ? chunks : [clean.slice(0, maxChars)];
}
/**
 * Generates an MP3 audio buffer from text using Google Translate TTS (100% free, no API key).
 */
export async function generateSpeechAudio(text, langCode) {
    const cleanLang = (langCode || 'en').toLowerCase().split(/[-_]/)[0] ?? 'en';
    const chunks = splitTextForTTS(text, 180);
    if (!chunks.length) {
        throw new Error('No text provided for speech generation.');
    }
    const buffers = [];
    for (const chunk of chunks) {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${encodeURIComponent(cleanLang)}&client=tw-ob`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Referer': 'https://translate.google.com/',
            },
        });
        if (!res.ok) {
            logger.warn({ status: res.status, chunk }, 'Google TTS fetch failed for chunk');
            throw new Error(`TTS service returned status ${res.status}`);
        }
        const arrayBuf = await res.arrayBuffer();
        buffers.push(Buffer.from(arrayBuf));
    }
    return Buffer.concat(buffers);
}
//# sourceMappingURL=tts.js.map