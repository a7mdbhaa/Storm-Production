export class SettingsCache {
    db;
    channelCache = new Map();
    guildCache = new Map();
    userRuleCache = new Map();
    ignoreTermsCache = new Map();
    allowedBotCache = new Map();
    allowedWebhookCache = new Map();
    managedWebhookCache = new Map();
    inFlight = new Map();
    constructor(db) {
        this.db = db;
    }
    async getOrFetch(map, key, ttlMs, fetcher) {
        const cached = map.get(key);
        if (cached && cached.expires > Date.now()) {
            return cached.value;
        }
        const inFlightKey = `${key}`;
        const existing = this.inFlight.get(inFlightKey);
        if (existing) {
            return existing;
        }
        const promise = (async () => {
            try {
                const val = await fetcher();
                map.set(key, { value: val, expires: Date.now() + ttlMs });
                return val;
            }
            finally {
                this.inFlight.delete(inFlightKey);
            }
        })();
        this.inFlight.set(inFlightKey, promise);
        return promise;
    }
    async getChannelSettings(channelId) {
        return this.getOrFetch(this.channelCache, channelId, 60_000, () => this.db.channelSettings.findUnique({
            where: { channelId },
            include: { group: { include: { channels: true } } }
        }));
    }
    async getGuildSettings(guildId) {
        return this.getOrFetch(this.guildCache, guildId, 60_000, () => this.db.guildSettings.findUnique({ where: { guildId } }));
    }
    async getUserRule(guildId, userId) {
        const key = `${guildId}:${userId}`;
        return this.getOrFetch(this.userRuleCache, key, 60_000, () => this.db.userRule.findUnique({ where: { guildId_userId: { guildId, userId } } }));
    }
    async getIgnoreTerms(guildId) {
        return this.getOrFetch(this.ignoreTermsCache, guildId, 60_000, async () => (await this.db.ignoreTerm.findMany({ where: { guildId } })).map(x => x.term));
    }
    async getAllowedBot(guildId, botId) {
        const key = `${guildId}:${botId}`;
        return this.getOrFetch(this.allowedBotCache, key, 60_000, () => this.db.allowedBot.findUnique({ where: { guildId_botId: { guildId, botId } } }));
    }
    async getAllowedWebhook(guildId, webhookId) {
        const key = `${guildId}:${webhookId}`;
        return this.getOrFetch(this.allowedWebhookCache, key, 60_000, () => this.db.allowedWebhook.findUnique({ where: { guildId_webhookId: { guildId, webhookId } } }));
    }
    async getManagedWebhook(channelId) {
        return this.getOrFetch(this.managedWebhookCache, channelId, 300_000, () => this.db.managedWebhook.findUnique({ where: { channelId } }));
    }
    invalidateChannel(channelId) {
        this.channelCache.delete(channelId);
    }
    invalidateAllChannels() {
        this.channelCache.clear();
    }
    invalidateGuild(guildId) {
        this.guildCache.delete(guildId);
    }
    invalidateUser(guildId, userId) {
        this.userRuleCache.delete(`${guildId}:${userId}`);
    }
    invalidateTerms(guildId) {
        this.ignoreTermsCache.delete(guildId);
    }
    invalidateBot(guildId, botId) {
        this.allowedBotCache.delete(`${guildId}:${botId}`);
    }
    invalidateWebhook(channelId) {
        this.managedWebhookCache.delete(channelId);
    }
    invalidateAllowedWebhook(guildId, webhookId) {
        this.allowedWebhookCache.delete(`${guildId}:${webhookId}`);
    }
    clear() {
        this.channelCache.clear();
        this.guildCache.clear();
        this.userRuleCache.clear();
        this.ignoreTermsCache.clear();
        this.allowedBotCache.clear();
        this.allowedWebhookCache.clear();
        this.managedWebhookCache.clear();
    }
}
//# sourceMappingURL=settings-cache.js.map