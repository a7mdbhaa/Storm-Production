import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, userMention, channelMention } from 'discord.js';
import { findLanguage, languages, searchLanguages } from '../../config/languages.js';
import { splitMessage } from '../../utils/message-splitter.js';
export const STATUS_MESSAGES = [
    'Online, active, and keeping our channels connected in memory of Storm ❤️',
    'Good dogs leave paw prints on our hearts forever. Ready to translate!',
    'Translating across channels to keep everyone together—just like a good companion 🐾',
    'Storm Translator is online and watching over all server conversations ✨',
    'Keeping all our language channels linked in honor of Storm 💙',
    'Always here, bridging languages and bringing people closer in Storm\'s memory 🐶',
    'A loyal companion for all our server conversations, active and ready!',
    'Forever part of our community—Storm Translator is online and connected 🌟',
    'Running smoothly and keeping every channel in sync for everyone ❤️',
];
const admin = (b) => b.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);
const lang = (b, name = 'language', required = true) => b.addStringOption((o) => o.setName(name).setDescription('Language name, native name, ISO code, or flag').setAutocomplete(true).setRequired(required));
const builders = [
    lang(new SlashCommandBuilder().setName('translate').setDescription('Translate text').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)), 'language').addStringOption((o) => o.setName('from').setDescription('Source language').setAutocomplete(true)).addBooleanOption((o) => o.setName('private').setDescription('Only you can see the result')),
    new SlashCommandBuilder().setName('detect').setDescription('Detect a message language').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('transliterate').setDescription('Transliterate text').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)).addStringOption(o => o.setName('script').setDescription('Target script').setRequired(true)),
    new SlashCommandBuilder().setName('languages').setDescription('List or search supported languages').addStringOption(o => o.setName('search').setDescription('Search text')),
    admin(lang(new SlashCommandBuilder().setName('channel-link').setDescription('Link this channel to a translation group').addStringOption(o => o.setName('group').setDescription('Group name').setRequired(true)))),
    admin(new SlashCommandBuilder().setName('channel-unlink').setDescription('Unlink this channel')),
    new SlashCommandBuilder().setName('channel-groups').setDescription('List translation groups'),
    admin(lang(new SlashCommandBuilder().setName('channel-language').setDescription('Set this channel language'))),
    admin(new SlashCommandBuilder().setName('channel-auto').setDescription('Enable same-channel automatic translation').addStringOption(o => o.setName('languages').setDescription('Comma-separated languages').setRequired(true))),
    admin(new SlashCommandBuilder().setName('channel-stop').setDescription('Disable same-channel automatic translation')),
    admin(new SlashCommandBuilder().setName('channel-style').setDescription('Override output style').addStringOption(o => o.setName('style').setDescription('S1–S9').setRequired(true))),
    admin(new SlashCommandBuilder().setName('channel-bots').setDescription('Control bot input').addStringOption(o => o.setName('mode').setDescription('Mode').setRequired(true).addChoices({ name: 'Allowed', value: 'allowed' }, { name: 'Disabled', value: 'disabled' }))),
    admin(new SlashCommandBuilder().setName('group-delete').setDescription('Delete a translation group').addStringOption(o => o.setName('group').setDescription('Name').setRequired(true))),
    admin(new SlashCommandBuilder().setName('group-rename').setDescription('Rename a translation group').addStringOption(o => o.setName('group').setDescription('Current name').setRequired(true)).addStringOption(o => o.setName('new-name').setDescription('New name').setRequired(true))),
    lang(new SlashCommandBuilder().setName('user-auto').setDescription('Automatically translate a user')).addUserOption((o) => o.setName('user').setDescription('User')),
    new SlashCommandBuilder().setName('user-stop').setDescription('Stop user automatic translation').addUserOption(o => o.setName('user').setDescription('User')),
    admin(new SlashCommandBuilder().setName('user-ban').setDescription('Ban translation access').addUserOption(o => o.setName('user').setDescription('User').setRequired(true))),
    admin(new SlashCommandBuilder().setName('user-unban').setDescription('Restore translation access').addUserOption(o => o.setName('user').setDescription('User').setRequired(true))),
    admin(new SlashCommandBuilder().setName('reaction-mode').setDescription('Set reaction output').addStringOption(o => o.setName('mode').setDescription('Mode').setRequired(true).addChoices({ name: 'DM', value: 'dm' }, { name: 'Channel', value: 'channel' }))),
    admin(new SlashCommandBuilder().setName('reaction-permissions').setDescription('Set reaction access').addStringOption(o => o.setName('mode').setDescription('Access').setRequired(true).addChoices({ name: 'Everyone', value: 'everyone' }, { name: 'Administrators', value: 'administrators' }, { name: 'Specific roles', value: 'roles' })).addRoleOption(o => o.setName('role').setDescription('Allowed role'))),
    ...['bot-allow', 'bot-deny'].map(n => admin(new SlashCommandBuilder().setName(n).setDescription(`${n.endsWith('allow') ? 'Allow' : 'Deny'} bot input`).addUserOption(o => o.setName('bot').setDescription('Bot').setRequired(true)))),
    new SlashCommandBuilder().setName('bot-list').setDescription('List allowed bots'),
    ...['webhook-allow', 'webhook-deny'].map(n => admin(new SlashCommandBuilder().setName(n).setDescription(`${n.endsWith('allow') ? 'Allow' : 'Deny'} webhook input`).addStringOption(o => o.setName('webhook').setDescription('Webhook ID').setRequired(true)))),
    new SlashCommandBuilder().setName('webhook-list').setDescription('List allowed webhooks'),
    admin(new SlashCommandBuilder().setName('ignore-add').setDescription('Protect a term').addStringOption(o => o.setName('term').setDescription('Term or phrase').setRequired(true)).addStringOption(o => o.setName('mode').setDescription('Matching mode').addChoices(...['exact', 'case-insensitive', 'prefix', 'suffix', 'contains'].map(x => ({ name: x, value: x }))))),
    admin(new SlashCommandBuilder().setName('ignore-remove').setDescription('Remove a protected term').addStringOption(o => o.setName('term').setDescription('Term').setRequired(true))),
    new SlashCommandBuilder().setName('ignore-list').setDescription('List protected terms'),
    admin(new SlashCommandBuilder().setName('ignore-channel').setDescription('Ignore this channel')),
    admin(new SlashCommandBuilder().setName('ignore-channel-remove').setDescription('Stop ignoring this channel')),
    admin(lang(new SlashCommandBuilder().setName('server-language').setDescription('Set default server language'))),
    admin(new SlashCommandBuilder().setName('server-style').setDescription('Set default style').addStringOption(o => o.setName('style').setDescription('S1–S9').setRequired(true))),
    new SlashCommandBuilder().setName('server-settings').setDescription('Show server configuration'),
    admin(new SlashCommandBuilder().setName('bot-locale').setDescription('Set interface locale').addStringOption(o => o.setName('locale').setDescription('en, ar, fr, de, es').setRequired(true).addChoices(...['en', 'ar', 'fr', 'de', 'es'].map(x => ({ name: x, value: x }))))),
    admin(new SlashCommandBuilder().setName('command-permissions').setDescription('Set command access').addStringOption(o => o.setName('mode').setDescription('Access').setRequired(true).addChoices({ name: 'Everyone', value: 'everyone' }, { name: 'Administrators', value: 'administrators' }, { name: 'Specific roles', value: 'roles' })).addRoleOption(o => o.setName('role').setDescription('Allowed role'))),
    new SlashCommandBuilder().setName('stats').setDescription('Show translation statistics'),
    new SlashCommandBuilder().setName('status').setDescription('Show bot status message'),
    new SlashCommandBuilder().setName('diagnostics').setDescription('Show detailed technical service diagnostics'),
    new SlashCommandBuilder().setName('version').setDescription('Show bot version'),
    new SlashCommandBuilder().setName('invite').setDescription('Get bot invite'),
    new SlashCommandBuilder().setName('help').setDescription('Show command help'),
    new SlashCommandBuilder().setName('tts').setDescription('Text-to-speech').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true))
];
export const commandData = builders.map(x => x.toJSON());
const requireGuild = (i) => { if (!i.guildId)
    throw new Error('This command is only available in servers.'); return i.guildId; };
const parseLang = (v) => { const l = findLanguage(v); if (!l)
    throw new Error(`Unknown language: ${v}`); return l; };
const ok = (i, text) => i.reply({ content: `✅ ${text}`, ephemeral: true });
export async function autocomplete(i) { const q = i.options.getFocused(); await i.respond(searchLanguages(q).map(l => ({ name: `${l.name} — ${l.nativeName} (${l.code})`.slice(0, 100), value: l.code }))); }
export async function executeCommand(i, c) {
    const n = i.commandName, g = i.guildId;
    const banned = g ? await (c.settingsCache ? c.settingsCache.getUserRule(g, i.user.id) : c.db.userRule.findUnique({ where: { guildId_userId: { guildId: g, userId: i.user.id } } })) : null;
    if (banned?.banned)
        throw new Error('You are not permitted to use translation features.');
    if (n === 'translate') {
        await i.deferReply({ ephemeral: i.options.getBoolean('private') ?? true });
        const targets = i.options.getString('language', true).split(',').map(parseLang).slice(0, c.env.MAX_TARGET_LANGUAGES), source = i.options.getString('from'), text = i.options.getString('text', true), terms = g ? await (c.settingsCache ? c.settingsCache.getIgnoreTerms(g) : (await c.db.ignoreTerm.findMany({ where: { guildId: g } })).map(x => x.term)) : [];
        const result = await c.translation.translateMany({ text, ...(source ? { sourceLanguage: parseLang(source).code } : {}), protectedTerms: terms, targetLanguages: targets.map(x => x.code), guildId: g ?? undefined, channelId: i.channelId, userId: i.user.id });
        if (g) {
            const requests = Object.values(result.providerRequests).reduce((a, n) => a + n, 0);
            void c.db.translationBatchUsage.create({ data: { guildId: g, providerRequests: result.providerRequests, requestedLanguages: targets.length, producedLanguages: result.translations.size, cacheHits: [...result.translations.values()].filter(x => x.cached).length, fallbackOccurred: result.providerRequests.groq + result.providerRequests.google > 0, partialFallback: result.translations.size > 0 && requests > 1, characters: text.length, totalLatencyMs: result.totalLatencyMs } }).catch(() => undefined);
        }
        const parts = targets.map(target => `**${target.name}**\n${result.translations.get(target.code)?.translatedText ?? 'Unavailable'}`);
        await i.editReply(parts.join('\n\n'));
        return;
    }
    if (n === 'detect') {
        const d = await c.translation.detect(i.options.getString('text', true)), l = findLanguage(d.language);
        await i.reply({ content: `Detected language: ${l?.name ?? d.language} (${d.language})${d.confidence !== undefined ? ` — ${Math.round(d.confidence * 100)}% confidence` : ''}`, ephemeral: true });
        return;
    }
    if (n === 'transliterate') {
        await i.deferReply({ ephemeral: true });
        await i.editReply(await c.translation.transliterate(i.options.getString('text', true), i.options.getString('script', true)));
        return;
    }
    if (n === 'languages') {
        const q = i.options.getString('search') ?? '', list = q ? searchLanguages(q, 100) : languages;
        await i.reply({ content: splitMessage(list.map(l => `${l.name} — ${l.nativeName} — ${l.code}`).join('\n'))[0], ephemeral: true });
        return;
    }
    if (n === 'channel-link') {
        const guildId = requireGuild(i), name = i.options.getString('group', true).toLowerCase(), language = parseLang(i.options.getString('language', true)).code;
        const group = await c.db.translationGroup.upsert({ where: { guildId_name: { guildId, name } }, create: { guildId, name }, update: {} });
        await c.db.channelSettings.upsert({ where: { channelId: i.channelId }, create: { guildId, channelId: i.channelId, language, autoLanguages: [], groupId: group.id }, update: { language, groupId: group.id } });
        c.settingsCache?.invalidateAllChannels();
        return ok(i, `Linked ${channelMention(i.channelId)} to ${name} as ${language}.`);
    }
    if (n === 'channel-unlink') {
        const guildId = requireGuild(i);
        const row = await c.db.channelSettings.update({ where: { channelId: i.channelId }, data: { groupId: null } }).catch(() => null);
        if (row?.groupId && await c.db.channelSettings.count({ where: { groupId: row.groupId } }) === 0)
            await c.db.translationGroup.delete({ where: { id: row.groupId } });
        c.settingsCache?.invalidateAllChannels();
        return ok(i, 'Channel unlinked.');
    }
    if (n === 'channel-groups') {
        const rows = await c.db.translationGroup.findMany({ where: { guildId: requireGuild(i) }, include: { channels: true } });
        return i.reply({ content: rows.length ? rows.map(x => `**${x.name}**\n${x.channels.map(ch => `• ${channelMention(ch.channelId)} — ${ch.language}`).join('\n')}`).join('\n\n') : 'No groups configured.', ephemeral: true });
    }
    if (n === 'group-delete') {
        const guildId = requireGuild(i), name = i.options.getString('group', true);
        await c.db.translationGroup.delete({ where: { guildId_name: { guildId, name } } });
        c.settingsCache?.invalidateAllChannels();
        return ok(i, `Deleted ${name}.`);
    }
    if (n === 'group-rename') {
        const guildId = requireGuild(i);
        await c.db.translationGroup.update({ where: { guildId_name: { guildId, name: i.options.getString('group', true) } }, data: { name: i.options.getString('new-name', true) } });
        c.settingsCache?.invalidateAllChannels();
        return ok(i, 'Group renamed.');
    }
    if (['channel-language', 'channel-auto', 'channel-stop', 'channel-style', 'channel-bots', 'ignore-channel', 'ignore-channel-remove'].includes(n)) {
        const guildId = requireGuild(i), data = {};
        if (n === 'channel-language')
            data.language = parseLang(i.options.getString('language', true)).code;
        if (n === 'channel-auto') {
            data.autoEnabled = true;
            data.autoLanguages = i.options.getString('languages', true).split(',').map(parseLang).map(x => x.code);
        }
        if (n === 'channel-stop')
            data.autoEnabled = false;
        if (n === 'channel-style')
            data.style = i.options.getString('style', true);
        if (n === 'channel-bots')
            data.botsMode = i.options.getString('mode', true);
        if (n === 'ignore-channel')
            data.ignored = true;
        if (n === 'ignore-channel-remove')
            data.ignored = false;
        await c.db.channelSettings.upsert({ where: { channelId: i.channelId }, create: { guildId, channelId: i.channelId, autoLanguages: [], ...data }, update: data });
        c.settingsCache?.invalidateChannel(i.channelId);
        return ok(i, 'Channel configuration updated.');
    }
    if (['user-auto', 'user-stop', 'user-ban', 'user-unban'].includes(n)) {
        const guildId = requireGuild(i), user = i.options.getUser('user') ?? i.user, data = {};
        if (n === 'user-auto')
            data.autoLanguage = parseLang(i.options.getString('language', true)).code;
        if (n === 'user-stop')
            data.autoLanguage = null;
        if (n === 'user-ban')
            data.banned = true;
        if (n === 'user-unban')
            data.banned = false;
        await c.db.userRule.upsert({ where: { guildId_userId: { guildId, userId: user.id } }, create: { guildId, userId: user.id, ...data }, update: data });
        c.settingsCache?.invalidateUser(guildId, user.id);
        return ok(i, `Updated ${userMention(user.id)}.`);
    }
    if (['bot-allow', 'bot-deny'].includes(n)) {
        const guildId = requireGuild(i), bot = i.options.getUser('bot', true);
        if (!bot.bot)
            throw new Error('Selected user is not a bot.');
        if (n === 'bot-allow')
            await c.db.allowedBot.upsert({ where: { guildId_botId: { guildId, botId: bot.id } }, create: { guildId, botId: bot.id }, update: {} });
        else
            await c.db.allowedBot.deleteMany({ where: { guildId, botId: bot.id } });
        c.settingsCache?.invalidateBot(guildId, bot.id);
        return ok(i, 'Bot list updated.');
    }
    if (n === 'bot-list') {
        const x = await c.db.allowedBot.findMany({ where: { guildId: requireGuild(i) } });
        return i.reply({ content: x.length ? x.map(v => userMention(v.botId)).join('\n') : 'No allowed bots.', ephemeral: true });
    }
    if (['webhook-allow', 'webhook-deny'].includes(n)) {
        const guildId = requireGuild(i), webhookId = i.options.getString('webhook', true);
        if (n === 'webhook-allow')
            await c.db.allowedWebhook.upsert({ where: { guildId_webhookId: { guildId, webhookId } }, create: { guildId, webhookId }, update: {} });
        else
            await c.db.allowedWebhook.deleteMany({ where: { guildId, webhookId } });
        c.settingsCache?.invalidateAllowedWebhook(guildId, webhookId);
        return ok(i, 'Webhook list updated.');
    }
    if (n === 'webhook-list') {
        const x = await c.db.allowedWebhook.findMany({ where: { guildId: requireGuild(i) } });
        return i.reply({ content: x.length ? x.map(v => v.webhookId).join('\n') : 'No allowed webhooks.', ephemeral: true });
    }
    if (['ignore-add', 'ignore-remove'].includes(n)) {
        const guildId = requireGuild(i), term = i.options.getString('term', true);
        if (n === 'ignore-add')
            await c.db.ignoreTerm.create({ data: { guildId, term, mode: i.options.getString('mode') ?? 'exact' } });
        else
            await c.db.ignoreTerm.deleteMany({ where: { guildId, term } });
        c.settingsCache?.invalidateTerms(guildId);
        return ok(i, 'Protected terms updated.');
    }
    if (n === 'ignore-list') {
        const x = await c.db.ignoreTerm.findMany({ where: { guildId: requireGuild(i) } });
        return i.reply({ content: x.length ? x.map(v => `${v.term} (${v.mode})`).join('\n') : 'No protected terms.', ephemeral: true });
    }
    if (['server-language', 'server-style', 'reaction-mode', 'bot-locale', 'command-permissions', 'reaction-permissions'].includes(n)) {
        const guildId = requireGuild(i), data = {};
        if (n === 'server-language')
            data.defaultLanguage = parseLang(i.options.getString('language', true)).code;
        if (n === 'server-style')
            data.defaultStyle = i.options.getString('style', true);
        if (n === 'reaction-mode')
            data.reactionMode = i.options.getString('mode', true);
        if (n === 'bot-locale')
            data.botLocale = i.options.getString('locale', true);
        if (n.endsWith('permissions'))
            data[n.startsWith('command') ? 'commandPermission' : 'reactionPermission'] = { mode: i.options.getString('mode', true), roleId: i.options.getRole('role')?.id };
        await c.db.guildSettings.upsert({ where: { guildId }, create: { guildId, ...data }, update: data });
        c.settingsCache?.invalidateGuild(guildId);
        return ok(i, 'Server configuration updated.');
    }
    if (n === 'server-settings') {
        const guildId = requireGuild(i), [s, groups, terms, banned, bots, hooks, auto] = await Promise.all([c.db.guildSettings.findUnique({ where: { guildId } }), c.db.translationGroup.count({ where: { guildId } }), c.db.ignoreTerm.count({ where: { guildId } }), c.db.userRule.count({ where: { guildId, banned: true } }), c.db.allowedBot.count({ where: { guildId } }), c.db.allowedWebhook.count({ where: { guildId } }), c.db.channelSettings.count({ where: { guildId, autoEnabled: true } })]);
        return i.reply({ content: `Default language: ${s?.defaultLanguage ?? 'en'}\nDefault style: ${s?.defaultStyle ?? 'S5'}\nReaction mode: ${s?.reactionMode ?? 'dm'}\nCommand permissions: ${JSON.stringify(s?.commandPermission ?? { mode: 'everyone' })}\nReaction permissions: ${JSON.stringify(s?.reactionPermission ?? { mode: 'everyone' })}\nAutomatic translation channels: ${auto}\nTranslation groups: ${groups}\nIgnored terms: ${terms}\nBanned users: ${banned}\nAllowed bots: ${bots}\nAllowed webhooks: ${hooks}\nBot locale: ${s?.botLocale ?? 'en'}`, ephemeral: true });
    }
    if (n === 'stats') {
        const guildId = requireGuild(i), now = new Date(), day = new Date(now.getFullYear(), now.getMonth(), now.getDate()), month = new Date(now.getFullYear(), now.getMonth(), 1), [rows, batches] = await Promise.all([c.db.translationUsage.findMany({ where: { guildId, createdAt: { gte: month } } }), c.db.translationBatchUsage.findMany({ where: { guildId, createdAt: { gte: month } } })]);
        const success = rows.filter(x => x.success), by = (p) => success.filter(x => x.provider === p).length, today = batches.filter(x => x.createdAt >= day), requests = today.reduce((sum, x) => sum + Object.values(x.providerRequests).reduce((a, n) => a + n, 0), 0), produced = today.reduce((sum, x) => sum + x.producedLanguages, 0), cacheHits = today.reduce((sum, x) => sum + x.cacheHits, 0);
        return i.reply({ content: `Translations today: ${rows.filter(x => x.createdAt >= day).length}\nTranslations this month: ${rows.length}\nSuccessful translations: ${success.length}\nFailed translations: ${rows.length - success.length}\nGemini translations: ${by('gemini')}\nGroq translations: ${by('groq')}\nGoogle Translate translations: ${by('google')}\nCache hits: ${success.filter(x => x.cached).length}\nAverage latency: ${success.length ? Math.round(success.reduce((a, x) => a + x.latencyMs, 0) / success.length) : 0} ms\nCharacters translated: ${success.reduce((a, x) => a + x.characters, 0)}\nProvider API requests today: ${requests}\nTranslations produced today: ${produced}\nAverage languages per provider request: ${requests ? (produced / requests).toFixed(1) : '0'}\nBatch cache hit rate: ${produced + cacheHits ? Math.round(cacheHits / (produced + cacheHits) * 100) : 0}%`, ephemeral: true });
    }
    if (n === 'status') {
        const msg = STATUS_MESSAGES[Math.floor(Math.random() * STATUS_MESSAGES.length)];
        const embed = new EmbedBuilder().setColor(0xFF94B8).setAuthor({ name: '🐾  Storm Translator  ✨', iconURL: c.client.user?.displayAvatarURL() }).setDescription(`> ❝ *${msg}* ❞\n\n・ ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈ ・\n✨ *Always watching over our server conversations* 💕`).setFooter({ text: 'Forever loved, forever our good companion 🐾 ˖⁺‧₊˚', iconURL: c.client.user?.displayAvatarURL() }).setTimestamp();
        return i.reply({ embeds: [embed] });
    }
    if (n === 'diagnostics') {
        const hs = (p) => c.translation.health.status(p, !!c.translation.providers.find(x => x.name === p)?.isConfigured());
        return i.reply({ content: `🌐 Translator Bot Diagnostics\n\nBot status: Online.\nDiscord gateway: ${c.client.isReady() ? 'Connected' : 'Reconnecting'}.\nHosting environment: Wispbyte.\nWispbyte bot process: Healthy.\nGemini provider: ${hs('gemini')}.\nGroq provider: ${hs('groq')}.\nGoogle Translate provider: ${hs('google')}.\nTranslation fallback order: Gemini → Groq → Google Translate.\nDatabase: Connected to Neon PostgreSQL.\nTranslation cache: ${c.env.ENABLE_TRANSLATION_CACHE ? 'Enabled' : 'Disabled'}.\nTranslation queue: ${c.translation.queue.size} request(s) waiting.\nAutomatic translation: Running.\nFlag-reaction translation: Running.\nWebhook mirroring: Ready.\nUptime: ${Math.floor(process.uptime())} seconds.\nVersion: ${c.env.BOT_VERSION}.\nThe bot is ready to translate messages.`, ephemeral: true });
    }
    else if (n === 'version')
        await i.reply({ content: `Translator Bot version ${c.env.BOT_VERSION}`, ephemeral: true });
    else if (n === 'invite')
        await i.reply({ content: `https://discord.com/oauth2/authorize?client_id=${c.env.DISCORD_CLIENT_ID}&scope=bot%20applications.commands&permissions=536946752`, ephemeral: true });
    else if (n === 'help')
        await i.reply({ embeds: [new EmbedBuilder().setTitle('Storm Translator Help').setDescription('**Translation**\n/translate /detect /transliterate /languages\n**Automatic Translation**\n/channel-language /channel-auto /channel-stop /user-auto /user-stop\n**Language Channels**\n/channel-link /channel-unlink /channel-groups /group-delete /group-rename\n**Reaction Translation**\nReact with a flag or 🌐; configure /reaction-mode\n**Administration**\n/server-settings /ignore-add /command-permissions\n**Information**\n/stats /status /diagnostics /version /invite')], ephemeral: true });
    else if (n === 'tts')
        await i.reply({ content: c.env.ENABLE_TTS ? 'No TTS provider is configured.' : 'Text-to-speech is currently disabled on this bot.', ephemeral: true });
}
//# sourceMappingURL=index.js.map