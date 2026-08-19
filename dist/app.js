import { ActivityType, Client, Events, GatewayIntentBits, MessageFlags, Partials } from 'discord.js';
import { autocomplete, executeCommand } from './bot/commands/index.js';
import { onMessage, onMessageDelete, onMessageUpdate } from './services/discord/automatic-translation.js';
import { onReaction } from './services/discord/reactions.js';
import { logger } from './utils/logger.js';
export function createClient() { return new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessageReactions], partials: [Partials.Message, Partials.Channel, Partials.Reaction] }); }
export function registerEvents(c) { c.client.once(Events.ClientReady, client => { client.user.setActivity('multilingual conversations', { type: ActivityType.Watching }); logger.info({ guilds: client.guilds.cache.size }, 'Discord connected; bot ready'); }); c.client.on(Events.InteractionCreate, async (i) => { try {
    if (i.isAutocomplete())
        await autocomplete(i);
    else if (i.isChatInputCommand())
        await executeCommand(i, c);
}
catch (e) {
    logger.error({ error: e instanceof Error ? e.message : 'unknown' }, 'Interaction failed');
    if (i.isRepliable()) {
        const content = e instanceof Error ? e.message : 'An unexpected error occurred.';
        if (i.deferred || i.replied)
            await i.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined);
        else
            await i.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined);
    }
} }); c.client.on(Events.MessageCreate, m => void onMessage(m, c)); c.client.on(Events.MessageUpdate, (a, b) => void onMessageUpdate(a, b, c)); c.client.on(Events.MessageDelete, m => void onMessageDelete(m, c)); c.client.on(Events.MessageReactionAdd, (r, u) => void onReaction(r, u, c)); }
//# sourceMappingURL=app.js.map