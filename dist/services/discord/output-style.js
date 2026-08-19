import { WebhookClient } from 'discord.js';
import { logger } from '../../utils/logger.js';
export function resolveEffectiveStyle(channelStyle, guildStyle, configuredDefault = 'S9') { const value = channelStyle ?? guildStyle ?? configuredDefault; return /^S(?:1B?|2|3|4|5|6B?|7|8|9)$/.test(value) ? value : configuredDefault; }
export class TranslationOutputRenderer {
    db;
    webhookFactory;
    settingsCache;
    webhookClients = new Map();
    constructor(db, webhookFactory = credentials => new WebhookClient(credentials), settingsCache) {
        this.db = db;
        this.webhookFactory = webhookFactory;
        this.settingsCache = settingsCache;
    }
    async createWebhook(channel) { try {
        const hook = await channel.createWebhook({ name: 'Storm Translator', reason: 'Managed S9 translation output' });
        if (!hook.token)
            throw new Error('Discord did not return a webhook token');
        const row = await this.db.managedWebhook.upsert({ where: { channelId: channel.id }, create: { channelId: channel.id, guildId: channel.guild.id, webhookId: hook.id, token: hook.token }, update: { webhookId: hook.id, token: hook.token, guildId: channel.guild.id } });
        if (this.settingsCache)
            this.settingsCache.invalidateWebhook(channel.id);
        const client = this.webhookFactory({ id: row.webhookId, token: row.token });
        this.webhookClients.set(channel.id, client);
        return client;
    }
    catch (e) {
        logger.error({ channelId: channel.id, error: e instanceof Error ? e.message : 'unknown' }, 'Cannot create managed translation webhook; verify Manage Webhooks permission');
        throw new Error('S9 webhook output requires Manage Webhooks permission in the destination channel.');
    } }
    async webhook(channel) { const cachedClient = this.webhookClients.get(channel.id); if (cachedClient)
        return cachedClient; const row = this.settingsCache ? await this.settingsCache.getManagedWebhook(channel.id) : await this.db.managedWebhook.findUnique({ where: { channelId: channel.id } }); if (row) {
        const client = this.webhookFactory({ id: row.webhookId, token: row.token });
        this.webhookClients.set(channel.id, client);
        return client;
    } return this.createWebhook(channel); }
    identity(source) { return { username: source.member?.displayName ?? source.author.globalName ?? source.author.username, avatarURL: source.member?.displayAvatarURL({ size: 128 }) ?? source.author.displayAvatarURL({ size: 128 }) }; }
    async replyHeader(source, destinationId) { if (!source.reference?.messageId)
        return ''; const mapping = await this.db.translatedMessage.findFirst({ where: { originalMessageId: source.reference.messageId, translatedChannelId: destinationId, partIndex: 0 } }), url = mapping ? `https://discord.com/channels/${source.guildId}/${destinationId}/${mapping.translatedMessageId}` : `https://discord.com/channels/${source.guildId}/${source.reference.channelId ?? source.channelId}/${source.reference.messageId}`; let excerpt = 'Referenced message'; try {
        const referenced = await source.fetchReference();
        excerpt = referenced.content.replace(/\s+/g, ' ').slice(0, 120) || excerpt;
    }
    catch { /* compact link remains available */ } return `> [↩ **REPLY**](${url}) *${excerpt.replace(/[*_`]/g, '\\$&')}*\n`; }
    format(style, content) { switch (style) {
        case 'S1':
        case 'S1B':
        case 'S2':
        case 'S3':
        case 'S4': return `> Translation\n${content}`;
        case 'S6':
        case 'S6B': return content.replace(/\s*\n\s*/g, ' ');
        case 'S7': return `**Translation**\n${content}`;
        case 'S8': return `>>> ${content}`;
        default: return content;
    } }
    async send(input) { if (input.style !== 'S9') {
        const payload = { content: this.format(input.style, input.content), allowedMentions: { parse: [], repliedUser: false } };
        return input.sameChannel ? input.source.reply(payload) : input.destination.send(payload);
    } const header = await this.replyHeader(input.source, input.destination.id), identity = this.identity(input.source), options = { content: `${header}${input.content}`, ...identity, allowedMentions: { parse: [] } }; let webhook = await this.webhook(input.destination); try {
        return await webhook.send(options);
    }
    catch (first) {
        logger.warn({ channelId: input.destination.id, error: first instanceof Error ? first.message : 'unknown' }, 'Managed webhook send failed; recreating once');
        this.webhookClients.delete(input.destination.id);
        if (this.settingsCache)
            this.settingsCache.invalidateWebhook(input.destination.id);
        await this.db.managedWebhook.deleteMany({ where: { channelId: input.destination.id } });
        webhook = await this.createWebhook(input.destination);
        return webhook.send(options);
    } }
    async edit(channel, messageId, content) { const cachedClient = this.webhookClients.get(channel.id); if (cachedClient?.editMessage)
        return cachedClient.editMessage(messageId, { content, allowedMentions: { parse: [] } }); const row = this.settingsCache ? await this.settingsCache.getManagedWebhook(channel.id) : await this.db.managedWebhook.findUnique({ where: { channelId: channel.id } }); if (row) {
        const webhook = this.webhookFactory({ id: row.webhookId, token: row.token });
        this.webhookClients.set(channel.id, webhook);
        if (webhook.editMessage)
            return webhook.editMessage(messageId, { content, allowedMentions: { parse: [] } });
    } const message = await channel.messages.fetch(messageId); return message.edit({ content, allowedMentions: { parse: [] } }); }
}
//# sourceMappingURL=output-style.js.map