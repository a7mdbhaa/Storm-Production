import { randomBytes } from 'node:crypto';
const STANDARD = [/```[\s\S]*?```/g, /`[^`\n]+`/g, /<@!?\d{5,}>/g, /<@&\d{5,}>/g, /<#\d{5,}>/g, /<a?:[A-Za-z0-9_]+:\d{5,}>/g, /<t:\d{1,}(?::[tTdDfFR])?>/g, /https?:\/\/[^\s<>]+/g, /\{\{protect:[\s\S]*?\}\}/g];
export function protectTokens(input, terms = []) { const nonce = randomBytes(8).toString('hex'); const values = new Map(); let n = 0; const save = (v) => { const key = `ZXQ${nonce}${n++}QXZ`; values.set(key, v.startsWith('{{protect:') ? v.slice(10, -2) : v); return key; }; let text = input; for (const pattern of STANDARD)
    text = text.replace(pattern, save); for (const term of [...terms].sort((a, b) => b.length - a.length)) {
    if (!term)
        continue;
    text = text.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), save);
} return { text, restore(value) { let out = value; for (const [key, original] of values) {
        const variants = [key, `__${key}__`, `**${key}**`];
        const found = variants.find(k => out.includes(k));
        if (!found)
            throw new Error('Translation provider lost a protected token');
        out = out.replaceAll(found, original);
    } return out; } }; }
//# sourceMappingURL=token-protection.js.map