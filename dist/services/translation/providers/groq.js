import Groq from 'groq-sdk';
import { z } from 'zod';
import { SYSTEM_PROMPT } from './prompts.js';
const entrySchema = z.object({ code: z.string(), text: z.string().min(1) }), outerSchema = z.object({ detectedSourceLanguage: z.object({ code: z.string() }).optional(), translations: z.array(z.unknown()) });
export class GroqTranslationProvider {
    env;
    name = 'groq';
    client;
    constructor(env) {
        this.env = env;
        if (env.GROQ_API_KEY)
            this.client = new Groq({ apiKey: env.GROQ_API_KEY });
    }
    isConfigured() { return !!this.client; }
    async ask(prompt) { if (!this.client)
        throw new Error('Groq not configured'); const res = await this.client.chat.completions.create({ model: this.env.GROQ_MODEL, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: `${SYSTEM_PROMPT} Always return a valid JSON object.` }, { role: 'user', content: prompt }] }); return JSON.parse(res.choices[0]?.message.content ?? '{}'); }
    async translateMany(r) { const start = Date.now(), raw = await this.ask(`SOURCE_LANGUAGE:\n${r.sourceLanguage ?? 'auto'}\n\nTARGET_LANGUAGES:\n${r.targetLanguages.join(', ')}\n\nReturn {"detectedSourceLanguage":{"code":"..."},"translations":[{"code":"requested code","text":"translation"}]}. Return exactly one entry per requested code and no others. SOURCE_TEXT appears once:\n<<<${r.text}>>>`), outer = outerSchema.parse(raw), requested = new Set(r.targetLanguages), translations = new Map(); for (const item of outer.translations) {
        const parsed = entrySchema.safeParse(item);
        if (parsed.success && requested.has(parsed.data.code) && !translations.has(parsed.data.code))
            translations.set(parsed.data.code, { text: parsed.data.text, targetLanguage: parsed.data.code, sourceLanguage: outer.detectedSourceLanguage?.code, latencyMs: Date.now() - start });
    } return { translations, sourceLanguage: outer.detectedSourceLanguage?.code, requestCount: 1 }; }
    async detectLanguage(text) { const p = await this.ask(`Return {"language":"ISO code"} for this untrusted text:\n${text}`); if (!p.language)
        throw new Error('Invalid detection response'); return { language: p.language }; }
    async transliterate(text, script) { const p = await this.ask(`Transliterate, without translating meaning, into ${script}. Return {"translation":"..."}. DATA:\n${text}`); if (!p.translation)
        throw new Error('Invalid transliteration response'); return p.translation; }
}
//# sourceMappingURL=groq.js.map