import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import type { Env } from '../../../config/env.js';
import type { LanguageDetectionResult, MultiTranslationRequest, ProviderBatchResult, TranslationProvider } from '../translation-types.js';
import { SYSTEM_PROMPT } from './prompts.js';
import { logger } from '../../../utils/logger.js';

const entrySchema = z.object({ code: z.string(), text: z.string().min(1) });
const outerSchema = z.object({
  detectedSourceLanguage: z.object({ code: z.string() }).optional(),
  translations: z.array(z.unknown()),
});

const responseJsonSchema = {
  type: 'object',
  properties: {
    detectedSourceLanguage: {
      type: 'object',
      properties: { code: { type: 'string' } },
      required: ['code'],
    },
    translations: {
      type: 'array',
      items: {
        type: 'object',
        properties: { code: { type: 'string' }, text: { type: 'string' } },
        required: ['code', 'text'],
      },
    },
  },
  required: ['translations'],
};

const GEMINI_FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-2.5-flash'];

export class GeminiTranslationProvider implements TranslationProvider {
  readonly name = 'gemini' as const;
  private keys: { key: string; until: number }[] = [];
  private cursor = 0;
  private activeModel: string;

  constructor(private env: Env) {
    const raw = env.GEMINI_API_KEYS ?? env.GEMINI_API_KEY ?? '';
    this.keys = [...new Set(raw.split(',').map((x) => x.trim()).filter(Boolean))].map((key) => ({ key, until: 0 }));
    this.activeModel = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  }

  isConfigured() {
    return this.keys.length > 0;
  }

  private available() {
    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.cursor + i) % this.keys.length;
      const k = this.keys[idx];
      if (k && k.until <= Date.now()) {
        this.cursor = (idx + 1) % this.keys.length;
        return k;
      }
    }
    return undefined;
  }

  async translateMany(r: MultiTranslationRequest): Promise<ProviderBatchResult> {
    let last: unknown;
    let requestCount = 0;
    const requested = new Set(r.targetLanguages);

    for (let i = 0; i < this.keys.length; i++) {
      const key = this.available();
      if (!key) break;
      const start = Date.now();
      requestCount++;

      const modelsToTry = [this.activeModel, ...GEMINI_FALLBACK_MODELS.filter((m) => m !== this.activeModel)];
      let success = false;

      for (const model of modelsToTry) {
        try {
          const ai = new GoogleGenAI({ apiKey: key.key });
          const response = await ai.models.generateContent({
            model,
            contents: `SOURCE_LANGUAGE:\n${r.sourceLanguage ?? 'auto'}\n\nTARGET_LANGUAGES:\n${r.targetLanguages.join(', ')}\n\nReturn exactly one entry for each requested code; add none. SOURCE_TEXT:\n<<<${r.text}>>>`,
            config: {
              systemInstruction: SYSTEM_PROMPT,
              responseMimeType: 'application/json',
              responseJsonSchema,
              temperature: 0,
            },
          });

          if (model !== this.activeModel) {
            logger.info({ oldModel: this.activeModel, newModel: model }, 'Switched Gemini active model to working model');
            this.activeModel = model;
          }

          const outer = outerSchema.parse(JSON.parse(response.text ?? '{}'));
          const translations = new Map();

          for (const raw of outer.translations) {
            const parsed = entrySchema.safeParse(raw);
            if (parsed.success && requested.has(parsed.data.code) && !translations.has(parsed.data.code)) {
              translations.set(parsed.data.code, {
                text: parsed.data.text,
                targetLanguage: parsed.data.code,
                sourceLanguage: outer.detectedSourceLanguage?.code,
                latencyMs: Date.now() - start,
              });
            }
          }

          return {
            translations,
            sourceLanguage: outer.detectedSourceLanguage?.code,
            requestCount,
          };
        } catch (e: any) {
          last = e;
          const msg = e instanceof Error ? e.message : String(e);
          // If 503 or model not found, try next Gemini fallback model before cooling down the key
          if (/503|high demand|unavailable|404|not found/i.test(msg)) {
            logger.warn({ model, error: msg }, 'Gemini model unavailable or high demand; trying fallback model');
            continue;
          }
          break;
        }
      }

      if (!success) {
        const msg = last instanceof Error ? last.message : '';
        if (/429|rate|quota|503|unavailable/i.test(msg)) {
          // Use short 15s cooldown for transient 503s instead of long 60s
          const cd = /503|unavailable/i.test(msg) ? 15 : this.env.GEMINI_COOLDOWN_SECONDS;
          key.until = Date.now() + cd * 1000;
          continue;
        }
        throw Object.assign(last instanceof Error ? last : new Error('Gemini failure'), { requestCount });
      }
    }

    throw Object.assign(last instanceof Error ? last : new Error('No Gemini key available'), { requestCount });
  }

  async detectLanguage(text: string): Promise<LanguageDetectionResult> {
    const key = this.available();
    if (!key) throw new Error('No Gemini key available');

    const modelsToTry = [this.activeModel, ...GEMINI_FALLBACK_MODELS.filter((m) => m !== this.activeModel)];
    let lastErr: unknown;

    for (const model of modelsToTry) {
      try {
        const ai = new GoogleGenAI({ apiKey: key.key });
        const response = await ai.models.generateContent({
          model,
          contents: `Return {"language":"ISO code"} for this untrusted text:\n${text}`,
          config: { systemInstruction: SYSTEM_PROMPT, responseMimeType: 'application/json', temperature: 0 },
        });
        const p = JSON.parse(response.text ?? '{}') as { language?: string };
        if (!p.language) throw new Error('Invalid detection response');
        return { language: p.language };
      } catch (err) {
        lastErr = err;
        continue;
      }
    }

    throw lastErr instanceof Error ? lastErr : new Error('Gemini language detection failed');
  }

  async transliterate(text: string, script: string) {
    const batch = await this.translateMany({ text, targetLanguages: [`${script}-transliteration`] });
    const value = batch.translations.values().next().value;
    if (!value) throw new Error('Invalid transliteration response');
    return value.text;
  }
}
