import PQueue from 'p-queue';
import { logger } from '../../utils/logger.js';
import { ProviderHealth } from '../provider-health/health.js';
import { protectTokens } from './token-protection.js';
import { TranslationUnavailableError } from './translation-types.js';
const DEPTH = { gemini: 0, groq: 1, google: 2 };
export class TranslationManager {
    providers;
    cache;
    env;
    queue;
    health;
    inFlight = new Map();
    constructor(providers, cache, env) {
        this.providers = providers;
        this.cache = cache;
        this.env = env;
        this.queue = new PQueue({ concurrency: env.MAX_TRANSLATION_CONCURRENCY });
        this.health = new ProviderHealth(3, 60_000, env.GEMINI_COOLDOWN_SECONDS * 1000);
    }
    async translate(request) { const result = await this.translateMany({ text: request.text, sourceLanguage: request.sourceLanguage, targetLanguages: [request.targetLanguage], protectedTerms: request.protectedTerms }); const value = result.translations.get(request.targetLanguage); if (!value)
        throw new TranslationUnavailableError(); return value; }
    async translateMany(request) { if (!request.text.trim() || request.text.length > 20_000)
        throw new Error('Text must contain 1–20,000 characters.'); const started = Date.now(), targets = [...new Set(request.targetLanguages)].slice(0, this.env.MAX_TARGET_LANGUAGES); if (!targets.length)
        throw new Error('At least one target language is required.'); const translations = new Map(), owned = [], waiting = new Map(); for (const targetLanguage of targets) {
        const single = { text: request.text, targetLanguage, sourceLanguage: request.sourceLanguage, protectedTerms: request.protectedTerms };
        const cached = await this.cache.get(single);
        if (cached) {
            translations.set(targetLanguage, cached);
            continue;
        }
        const key = this.cache.key(single), existing = this.inFlight.get(key);
        if (existing)
            waiting.set(targetLanguage, existing);
        else
            owned.push(targetLanguage);
    } let operation; if (owned.length) {
        operation = this.queue.add(() => this.perform({ ...request, targetLanguages: owned }));
        for (const targetLanguage of owned) {
            const key = this.cache.key({ text: request.text, targetLanguage, sourceLanguage: request.sourceLanguage, protectedTerms: request.protectedTerms }), promise = operation.then(x => x.translations.get(targetLanguage)).finally(() => this.inFlight.delete(key));
            this.inFlight.set(key, promise);
            waiting.set(targetLanguage, promise);
        }
    } for (const [target, promise] of waiting) {
        const value = await promise;
        if (value)
            translations.set(target, value);
    } const op = operation ? await operation : undefined; return { sourceLanguage: op?.sourceLanguage ?? translations.values().next().value?.sourceLanguage, translations, failedLanguages: targets.filter(x => !translations.has(x)), totalLatencyMs: Date.now() - started, providerRequests: op?.providerRequests ?? { gemini: 0, groq: 0, google: 0 } }; }
    async perform(request) { const started = Date.now(), protectedSource = protectTokens(request.text, request.protectedTerms), translations = new Map(), providerRequests = { gemini: 0, groq: 0, google: 0 }; let remaining = [...request.targetLanguages], sourceLanguage = request.sourceLanguage; for (const provider of this.providers) {
        if (!remaining.length)
            break;
        if (!provider.isConfigured() || !this.health.canUse(provider.name))
            continue;
        for (const batch of this.batches(remaining, request.text.length, provider.name)) {
            try {
                const result = await this.timeout(provider.translateMany({ ...request, text: protectedSource.text, targetLanguages: batch }), provider.name, batch.length);
                providerRequests[provider.name] += result.requestCount;
                sourceLanguage ??= result.sourceLanguage;
                for (const [target, value] of result.translations) {
                    if (!batch.includes(target) || translations.has(target))
                        continue;
                    try {
                        const translatedText = protectedSource.restore(value.text), translation = { translatedText, sourceLanguage: value.sourceLanguage ?? sourceLanguage, targetLanguage: target, provider: provider.name, latencyMs: value.latencyMs, fallbackDepth: DEPTH[provider.name], cached: false };
                        translations.set(target, translation);
                        await this.cache.set({ text: request.text, targetLanguage: target, sourceLanguage: request.sourceLanguage, protectedTerms: request.protectedTerms }, translation);
                    }
                    catch (e) {
                        logger.warn({ provider: provider.name, target, error: e instanceof Error ? e.message : 'invalid token output' }, 'Discarding invalid batch translation entry');
                    }
                }
                this.health.success(provider.name);
            }
            catch (e) {
                const count = typeof e === 'object' && e && 'requestCount' in e ? Number(e.requestCount) : 1;
                providerRequests[provider.name] += Number.isFinite(count) ? count : 1;
                const msg = e instanceof Error ? e.message : 'provider failure';
                this.health.failure(provider.name, /429|rate|quota/i.test(msg));
                logger.warn({ provider: provider.name, error: msg }, 'Batch provider failed; trying fallback');
                break;
            }
        }
        remaining = remaining.filter(x => !translations.has(x));
    } return { sourceLanguage, translations, failedLanguages: remaining, totalLatencyMs: Date.now() - started, providerRequests }; }
    batches(targets, sourceLength, provider) { if (provider === 'google')
        return targets.map(x => [x]); const safeByOutput = Math.max(1, Math.floor(80_000 / Math.max(1, sourceLength * 1.6))), size = Math.max(1, Math.min(this.env.MAX_TRANSLATION_BATCH_SIZE, safeByOutput)); const out = []; for (let i = 0; i < targets.length; i += size)
        out.push(targets.slice(i, i + size)); return out; }
    baseTimeout(provider) { if (provider === 'gemini')
        return this.env.GEMINI_TIMEOUT_MS ?? Math.min(this.env.TRANSLATION_TIMEOUT_MS, 8000); if (provider === 'groq')
        return this.env.GROQ_TIMEOUT_MS ?? Math.min(this.env.TRANSLATION_TIMEOUT_MS, 8000); return this.env.GOOGLE_TRANSLATE_TIMEOUT_MS ?? Math.min(this.env.TRANSLATION_TIMEOUT_MS, 6000); }
    async timeout(promise, provider, targetCount) { const duration = Math.min(this.baseTimeout(provider) + Math.min(Math.max(0, targetCount - 1) * 200, 2800), 14_000); let timer; try {
        return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${provider} provider timeout`)), duration); })]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    } }
    async detect(text) { if (!/[\p{L}]{2,}/u.test(text.replace(/https?:\/\/\S+|<[^>]+>/g, '')))
        throw new Error('No meaningful natural language text found.'); for (const p of this.providers) {
        if (!p.isConfigured() || !p.detectLanguage || !this.health.canUse(p.name))
            continue;
        try {
            const value = await this.timeout(p.detectLanguage(text), p.name, 1);
            this.health.success(p.name);
            return value;
        }
        catch {
            this.health.failure(p.name);
        }
    } throw new TranslationUnavailableError(); }
    async transliterate(text, script) { for (const p of this.providers.filter(x => x.name !== 'google')) {
        if (!p.isConfigured() || !p.transliterate)
            continue;
        try {
            return await this.timeout(p.transliterate(text, script), p.name, 1);
        }
        catch {
            this.health.failure(p.name);
        }
    } throw new TranslationUnavailableError(); }
}
//# sourceMappingURL=translation-manager.js.map