import { createHash } from 'node:crypto';
export class TranslationCache {
    db;
    env;
    memory = new Map();
    writes = 0;
    constructor(db, env) {
        this.db = db;
        this.env = env;
    }
    key(r) { const normalized = r.text.normalize('NFC').trim().replace(/\s+/g, ' '); return createHash('sha256').update(`${normalized}\0${r.sourceLanguage ?? 'auto'}\0${r.targetLanguage}\0v1`).digest('hex'); }
    async get(r) { if (!this.env.ENABLE_TRANSLATION_CACHE)
        return null; const key = this.key(r), l1 = this.memory.get(key); if (l1) {
        this.memory.delete(key);
        this.memory.set(key, l1);
        return { ...l1, cached: true };
    } try {
        const row = await this.db.translationCache.findFirst({ where: { key, expiresAt: { gt: new Date() } } });
        if (!row)
            return null;
        const result = { translatedText: row.translatedText, sourceLanguage: row.sourceLanguage === 'auto' ? undefined : row.sourceLanguage, targetLanguage: row.targetLanguage, provider: row.provider, latencyMs: 0, fallbackDepth: { gemini: 0, groq: 1, google: 2 }[row.provider] ?? 0, cached: true };
        this.setMemory(key, result);
        return result;
    }
    catch {
        return null;
    } }
    async set(r, result) { if (!this.env.ENABLE_TRANSLATION_CACHE)
        return; const key = this.key(r), sourceHash = createHash('sha256').update(r.text).digest('hex'); this.setMemory(key, result); try {
        await this.db.translationCache.upsert({ where: { key }, create: { key, sourceHash, sourceLanguage: r.sourceLanguage ?? 'auto', targetLanguage: r.targetLanguage, translatedText: result.translatedText, provider: result.provider, expiresAt: new Date(Date.now() + this.env.TRANSLATION_CACHE_TTL_SECONDS * 1000) }, update: { translatedText: result.translatedText, provider: result.provider, expiresAt: new Date(Date.now() + this.env.TRANSLATION_CACHE_TTL_SECONDS * 1000) } });
        if (++this.writes % 100 === 0)
            await this.db.translationCache.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    }
    catch { /* L1 remains useful during transient Neon failures */ } }
    setMemory(key, value) { this.memory.set(key, value); while (this.memory.size > this.env.MEMORY_CACHE_MAX_ENTRIES) {
        const first = this.memory.keys().next().value;
        if (first)
            this.memory.delete(first);
        else
            break;
    } }
    get size() { return this.memory.size; }
}
//# sourceMappingURL=translation-cache.js.map