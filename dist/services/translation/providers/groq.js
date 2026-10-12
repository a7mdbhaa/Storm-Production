import Groq from 'groq-sdk';
import { z } from 'zod';
import { SYSTEM_PROMPT } from './prompts.js';
import { logger } from '../../../utils/logger.js';
const entrySchema = z.object({ code: z.string(), text: z.string().min(1) });
const outerSchema = z.object({
    detectedSourceLanguage: z.object({ code: z.string() }).optional(),
    translations: z.array(z.unknown()),
});
const GROQ_FALLBACK_MODELS = [
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'allam-2-7b',
];
export class GroqTranslationProvider {
    env;
    name = 'groq';
    client;
    activeModel;
    constructor(env) {
        this.env = env;
        if (env.GROQ_API_KEY) {
            this.client = new Groq({ apiKey: env.GROQ_API_KEY });
        }
        let model = env.GROQ_MODEL || 'qwen/qwen3.8-27b';
        // Automatically migrate deprecated qwen3.6 to active qwen3.8
        if (model === 'qwen/qwen3.6-27b') {
            model = 'qwen/qwen3.8-27b';
        }
        this.activeModel = model;
    }
    isConfigured() {
        return !!this.client;
    }
    async ask(prompt) {
        if (!this.client)
            throw new Error('Groq not configured');
        const modelsToTry = [this.activeModel, ...GROQ_FALLBACK_MODELS.filter((m) => m !== this.activeModel)];
        let lastError;
        for (const model of modelsToTry) {
            try {
                const res = await this.client.chat.completions.create({
                    model,
                    temperature: 0,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: `${SYSTEM_PROMPT} Always return a valid JSON object.` },
                        { role: 'user', content: prompt },
                    ],
                });
                if (model !== this.activeModel) {
                    logger.info({ oldModel: this.activeModel, newModel: model }, 'Switched Groq active model to fallback model');
                    this.activeModel = model;
                }
                return JSON.parse(res.choices[0]?.message.content ?? '{}');
            }
            catch (err) {
                lastError = err;
                const msg = err instanceof Error ? err.message : String(err);
                if (/model_not_found|does not exist|404|deprecated/i.test(msg)) {
                    logger.warn({ model, error: msg }, 'Groq model unavailable; attempting fallback model');
                    continue;
                }
                throw err;
            }
        }
        throw lastError instanceof Error ? lastError : new Error('All Groq models failed');
    }
    async translateMany(r) {
        const start = Date.now();
        const raw = await this.ask(`SOURCE_LANGUAGE:\n${r.sourceLanguage ?? 'auto'}\n\nTARGET_LANGUAGES:\n${r.targetLanguages.join(', ')}\n\nReturn {"detectedSourceLanguage":{"code":"..."},"translations":[{"code":"requested code","text":"translation"}]}. Return exactly one entry per requested code and no others. SOURCE_TEXT appears once:\n<<<${r.text}>>>`);
        const outer = outerSchema.parse(raw);
        const requested = new Set(r.targetLanguages);
        const translations = new Map();
        for (const item of outer.translations) {
            const parsed = entrySchema.safeParse(item);
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
            requestCount: 1,
        };
    }
    async detectLanguage(text) {
        const p = (await this.ask(`Return {"language":"ISO code"} for this untrusted text:\n${text}`));
        if (!p.language)
            throw new Error('Invalid detection response');
        return { language: p.language };
    }
    async transliterate(text, script) {
        const p = (await this.ask(`Transliterate, without translating meaning, into ${script}. Return {"translation":"..."}. DATA:\n${text}`));
        if (!p.translation)
            throw new Error('Invalid transliteration response');
        return p.translation;
    }
}
//# sourceMappingURL=groq.js.map