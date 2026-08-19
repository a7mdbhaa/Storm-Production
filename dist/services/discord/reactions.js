import { findLanguage, languagesForFlag } from '../../config/languages.js';
export async function onReaction(reaction, user, c) { if (user.bot)
    return; if (reaction.partial)
    await reaction.fetch(); const m = reaction.message; if (!m.guildId || !m.content)
    return; const userRule = c.settingsCache ? await c.settingsCache.getUserRule(m.guildId, user.id) : await c.db.userRule.findUnique({ where: { guildId_userId: { guildId: m.guildId, userId: user.id } } }); if (userRule?.banned)
    return; const emoji = reaction.emoji.name ?? '', settings = c.settingsCache ? await c.settingsCache.getGuildSettings(m.guildId) : await c.db.guildSettings.findUnique({ where: { guildId: m.guildId } }); let content; if (emoji === '\u{1F310}') {
    const d = await c.translation.detect(m.content), lang = findLanguage(d.language);
    content = `Detected language: ${lang?.name ?? d.language} (${d.language})`;
}
else {
    const target = languagesForFlag(emoji)[0];
    if (!target)
        return;
    const r = await c.translation.translate({ text: m.content, targetLanguage: target }), lang = findLanguage(target);
    content = `**${lang?.name ?? target} translation**\n\n${r.translatedText}\n\nOriginal: ${m.url}`;
} if ((settings?.reactionMode ?? 'dm') === 'channel')
    await m.reply({ content, allowedMentions: { parse: [], repliedUser: false } });
else
    await user.send({ content, allowedMentions: { parse: [] } }).catch(() => undefined); }
//# sourceMappingURL=reactions.js.map