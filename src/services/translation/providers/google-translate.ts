import type { Env } from '../../../config/env.js';
import type { LanguageDetectionResult, MultiTranslationRequest, ProviderBatchResult, TranslationProvider } from '../translation-types.js';

export class GoogleTranslationProvider implements TranslationProvider {
  readonly name = 'google' as const;

  constructor(private env: Env) {}

  isConfigured() {
    return true; // Always available as resilient free tier or official fallback
  }

  private async postOfficial(path: string, body: unknown) {
    const key = this.env.GOOGLE_TRANSLATE_API_KEY;
    if (!key) throw new Error('Google Translate API key not configured');
    const res = await fetch(`https://translation.googleapis.com/language/translate/v2${path}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Google Translate HTTP ${res.status}`);
    return (await res.json()) as any;
  }

  private async fetchFree(text: string, targetLanguage: string, sourceLanguage?: string): Promise<{ text: string; sourceLanguage?: string }> {
    const sl = sourceLanguage || 'auto';
    const cleanTl = targetLanguage.split(/[-_]/)[0] ?? targetLanguage;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(cleanTl)}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) throw new Error(`Free Google Translate HTTP ${res.status}`);
    const data = (await res.json()) as any;
    const translatedText = Array.isArray(data?.[0]) ? data[0].map((s: any) => s[0]).join('') : '';
    const detectedSource = data?.[2] ? String(data[2]) : undefined;
    return { text: translatedText, sourceLanguage: detectedSource };
  }

  async translateMany(r: MultiTranslationRequest): Promise<ProviderBatchResult> {
    const translations = new Map();
    const start = Date.now();
    let sourceLanguage = r.sourceLanguage;

    for (const targetLanguage of r.targetLanguages) {
      if (this.env.GOOGLE_TRANSLATE_API_KEY) {
        try {
          const j = await this.postOfficial('', {
            q: r.text,
            target: targetLanguage,
            ...(r.sourceLanguage ? { source: r.sourceLanguage } : {}),
          });
          const item = j.data?.translations?.[0];
          if (item?.translatedText) {
            sourceLanguage ??= item.detectedSourceLanguage;
            translations.set(targetLanguage, {
              text: item.translatedText,
              targetLanguage,
              sourceLanguage,
              latencyMs: Date.now() - start,
            });
            continue;
          }
        } catch {
          // If official key fails, try free endpoint
        }
      }

      // Free Google Translate fallback
      const free = await this.fetchFree(r.text, targetLanguage, sourceLanguage);
      if (free.text) {
        sourceLanguage ??= free.sourceLanguage;
        translations.set(targetLanguage, {
          text: free.text,
          targetLanguage,
          sourceLanguage,
          latencyMs: Date.now() - start,
        });
      }
    }

    return {
      translations,
      sourceLanguage,
      requestCount: r.targetLanguages.length,
    };
  }

  async detectLanguage(text: string): Promise<LanguageDetectionResult> {
    if (this.env.GOOGLE_TRANSLATE_API_KEY) {
      try {
        const j = await this.postOfficial('/detect', { q: text });
        const item = j.data?.detections?.[0]?.[0];
        if (item?.language) {
          return {
            language: item.language,
            ...(typeof item.confidence === 'number' ? { confidence: item.confidence } : {}),
          };
        }
      } catch {
        // Fall back to free detection
      }
    }

    const free = await this.fetchFree(text, 'en');
    if (!free.sourceLanguage) throw new Error('Invalid detection response');
    return { language: free.sourceLanguage };
  }
}
