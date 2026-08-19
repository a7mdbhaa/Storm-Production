import type { PrismaClient } from '@prisma/client';

interface CacheEntry<T> {
  value: T;
  expires: number;
}

export class SettingsCache {
  private channelCache = new Map<string, CacheEntry<any>>();
  private guildCache = new Map<string, CacheEntry<any>>();
  private userRuleCache = new Map<string, CacheEntry<any>>();
  private ignoreTermsCache = new Map<string, CacheEntry<string[]>>();
  private allowedBotCache = new Map<string, CacheEntry<any>>();
  private allowedWebhookCache = new Map<string, CacheEntry<any>>();
  private managedWebhookCache = new Map<string, CacheEntry<any>>();

  private inFlight = new Map<string, Promise<any>>();

  constructor(private db: PrismaClient) {}

  private async getOrFetch<T>(
    map: Map<string, CacheEntry<T>>,
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>
  ): Promise<T> {
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
      } finally {
        this.inFlight.delete(inFlightKey);
      }
    })();

    this.inFlight.set(inFlightKey, promise);
    return promise;
  }

  async getChannelSettings(channelId: string) {
    return this.getOrFetch(
      this.channelCache,
      channelId,
      60_000,
      () => this.db.channelSettings.findUnique({
        where: { channelId },
        include: { group: { include: { channels: true } } }
      })
    );
  }

  async getGuildSettings(guildId: string) {
    return this.getOrFetch(
      this.guildCache,
      guildId,
      60_000,
      () => this.db.guildSettings.findUnique({ where: { guildId } })
    );
  }

  async getUserRule(guildId: string, userId: string) {
    const key = `${guildId}:${userId}`;
    return this.getOrFetch(
      this.userRuleCache,
      key,
      60_000,
      () => this.db.userRule.findUnique({ where: { guildId_userId: { guildId, userId } } })
    );
  }

  async getIgnoreTerms(guildId: string): Promise<string[]> {
    return this.getOrFetch(
      this.ignoreTermsCache,
      guildId,
      60_000,
      async () => (await this.db.ignoreTerm.findMany({ where: { guildId } })).map(x => x.term)
    );
  }

  async getAllowedBot(guildId: string, botId: string) {
    const key = `${guildId}:${botId}`;
    return this.getOrFetch(
      this.allowedBotCache,
      key,
      60_000,
      () => this.db.allowedBot.findUnique({ where: { guildId_botId: { guildId, botId } } })
    );
  }

  async getAllowedWebhook(guildId: string, webhookId: string) {
    const key = `${guildId}:${webhookId}`;
    return this.getOrFetch(
      this.allowedWebhookCache,
      key,
      60_000,
      () => this.db.allowedWebhook.findUnique({ where: { guildId_webhookId: { guildId, webhookId } } })
    );
  }

  async getManagedWebhook(channelId: string) {
    return this.getOrFetch(
      this.managedWebhookCache,
      channelId,
      300_000,
      () => this.db.managedWebhook.findUnique({ where: { channelId } })
    );
  }

  invalidateChannel(channelId: string) {
    this.channelCache.delete(channelId);
  }

  invalidateAllChannels() {
    this.channelCache.clear();
  }

  invalidateGuild(guildId: string) {
    this.guildCache.delete(guildId);
  }

  invalidateUser(guildId: string, userId: string) {
    this.userRuleCache.delete(`${guildId}:${userId}`);
  }

  invalidateTerms(guildId: string) {
    this.ignoreTermsCache.delete(guildId);
  }

  invalidateBot(guildId: string, botId: string) {
    this.allowedBotCache.delete(`${guildId}:${botId}`);
  }

  invalidateWebhook(channelId: string) {
    this.managedWebhookCache.delete(channelId);
  }

  invalidateAllowedWebhook(guildId: string, webhookId: string) {
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
