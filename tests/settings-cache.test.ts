import { describe, it, expect, vi } from 'vitest';
import { SettingsCache } from '../src/services/discord/settings-cache.js';

describe('SettingsCache', () => {
  it('caches channel settings and avoids repeated db queries', async () => {
    const findUnique = vi.fn(async () => ({ channelId: 'ch-1', guildId: 'g-1', language: 'es' }));
    const db: any = {
      channelSettings: { findUnique },
    };

    const cache = new SettingsCache(db);
    const res1 = await cache.getChannelSettings('ch-1');
    const res2 = await cache.getChannelSettings('ch-1');

    expect(res1).toEqual(res2);
    expect(findUnique).toHaveBeenCalledTimes(1);

    cache.invalidateChannel('ch-1');
    await cache.getChannelSettings('ch-1');
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('caches guild settings and handles invalidation', async () => {
    const findUnique = vi.fn(async () => ({ guildId: 'g-1', defaultLanguage: 'en' }));
    const db: any = {
      guildSettings: { findUnique },
    };

    const cache = new SettingsCache(db);
    await cache.getGuildSettings('g-1');
    await cache.getGuildSettings('g-1');
    expect(findUnique).toHaveBeenCalledTimes(1);

    cache.invalidateGuild('g-1');
    await cache.getGuildSettings('g-1');
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('caches ignore terms and maps terms cleanly', async () => {
    const findMany = vi.fn(async () => [{ term: 'term1' }, { term: 'term2' }]);
    const db: any = {
      ignoreTerm: { findMany },
    };

    const cache = new SettingsCache(db);
    const terms1 = await cache.getIgnoreTerms('g-1');
    const terms2 = await cache.getIgnoreTerms('g-1');
    expect(terms1).toEqual(['term1', 'term2']);
    expect(terms2).toEqual(['term1', 'term2']);
    expect(findMany).toHaveBeenCalledTimes(1);

    cache.invalidateTerms('g-1');
    await cache.getIgnoreTerms('g-1');
    expect(findMany).toHaveBeenCalledTimes(2);
  });
});
