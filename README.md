# Storm Translation

A single-process, production-oriented multilingual Discord bot built with TypeScript, discord.js 14, Prisma, and Neon PostgreSQL. Translation follows the fixed order **Gemini → Groq → Google Cloud Translation**. It supports manual translation, automatic same-channel translation, linked language channels through reusable webhooks, flag reactions, language detection, persistent rules, message synchronization, caching, and usage statistics.

## Architecture

Discord Gateway/REST → one Node.js process on Wispbyte → bounded translation manager → Gemini/Groq/Google → Neon PostgreSQL. There is no HTTP keepalive server, Redis, Docker requirement, or local persistent state. L1 cache is bounded memory; L2 cache and every server setting live in Neon.

## Requirements

- Node.js 20 or newer and npm
- A Discord application and bot
- A Neon PostgreSQL project
- At least one translation provider key

## Discord Developer Portal setup

Create an application at the Discord Developer Portal, add a bot, copy the bot token and application ID into `DISCORD_TOKEN` and `DISCORD_CLIENT_ID`, and enable **Message Content Intent**. The code uses only Guilds, Guild Messages, Message Content, and Guild Message Reactions intents.

Invite the bot with the `bot` and `applications.commands` scopes. Required permissions are View Channels, Send Messages, Read Message History, Add Reactions, Embed Links, Attach Files, Use External Emojis, Manage Messages (synchronization), and Manage Webhooks (natural linked-channel output). Administrator is neither requested nor required.

## Provider setup

- Gemini: create a key in Google AI Studio. Set `GEMINI_API_KEY`, or set comma-separated `GEMINI_API_KEYS` for rotation. Rate-limited keys cool down independently.
- Groq: create a Groq API key and set `GROQ_API_KEY`.
- Google Cloud Translation: enable Cloud Translation API, create an API key restricted to that API, and set `GOOGLE_TRANSLATE_API_KEY`.

For up to 15 targets, the manager checks L1 and Neon independently for every language, protects the source once, and normally sends all true misses in one structured Gemini request. Only missing Gemini entries move to one Groq batch. Google Basic v2 receives only the final remainder, one target per request. Results retain per-language provider attribution and are cached independently. Provider failures trigger immediate sequential fallback with no default same-provider retry; Gemini may immediately try another configured key with the same remaining batch after quota or temporary failures.

## Setting up Neon PostgreSQL

1. Create a Neon project and database.
2. Copy its pooled connection string to `DATABASE_URL` (the running bot uses this).
3. Copy its direct connection string to `DIRECT_URL` (Prisma migrations use this).
4. Keep `sslmode=require` in Neon URLs where supplied.
5. Run `npm run db:generate` and `npm run db:deploy`.
6. Start the bot and verify the database line in `/status`.

Never commit either connection string. Database operations use Prisma parameterization; transient startup access is retried with bounded exponential backoff.

## Environment variables

Copy `.env.example` to `.env` locally. Required: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DATABASE_URL`, and `DIRECT_URL`. Configure one or more of `GEMINI_API_KEY`/`GEMINI_API_KEYS`, `GROQ_API_KEY`, and `GOOGLE_TRANSLATE_API_KEY`. `DISCORD_GUILD_ID` is optional and controls only development command registration, never runtime guild access. Batch defaults are `MAX_TARGET_LANGUAGES=15`, `MAX_TRANSLATION_BATCH_SIZE=15`, `TRANSLATION_MAX_RETRIES=0`, `GEMINI_TIMEOUT_MS=8000`, `GROQ_TIMEOUT_MS=8000`, and `GOOGLE_TRANSLATE_TIMEOUT_MS=6000`. All settings are validated with Zod.

## Local development and Prisma

```bash
npm install
npm run db:generate
npm run db:migrate
npm run deploy:commands
npm run dev
```

Use `npm run db:migrate` only while developing schema changes. Commit generated migrations. In production use `npm run db:deploy`; do not run `prisma migrate dev` at bot startup.

Build and run locally:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

## Deploying to Wispbyte

1. Create a Wispbyte account and a Node.js Discord-bot server.
2. Upload or connect this repository using the panel's supported workflow.
3. Select a current Node.js 20+ runtime/image.
4. In Startup settings, add all required environment variables from `.env.example`; never upload `.env`.
5. Install dependencies with `npm install` (or `npm ci` when the lockfile is present).
6. Run `npm run db:deploy` once per deployment containing new migrations.
7. Run `npm run deploy:commands` when commands change.
8. Set the exact Startup Command to `npm run wispbyte:start`.
9. Start the server and verify `/status`.

`wispbyte:start` runs `prisma generate`, compiles TypeScript, and starts `node dist/index.js`. It deliberately does not run development or destructive migrations. If your panel has a separate build phase, run `npm run build` there and use `npm start` as Startup Command.

## Linked language channels

In `#general-en`, run `/channel-link group:general language:English`; in `#general-ar`, use Arabic; optionally add French. Messages are translated to every other channel using one managed webhook per destination. Original display names and avatars are retained, pings are suppressed, attachment URLs are retained, generated IDs are persisted, edits retranslate mapped messages, and deletion removes mapped outputs where Discord permissions allow. Bot-owned webhooks and known translated IDs are always excluded to prevent loops.

## Complete command reference

- Translation: `/translate`, `/detect`, `/transliterate`, `/languages`
- Channels: `/channel-link`, `/channel-unlink`, `/channel-groups`, `/channel-language`, `/channel-auto`, `/channel-stop`, `/channel-style`, `/channel-bots`
- Groups: `/group-delete`, `/group-rename`
- Users: `/user-auto`, `/user-stop`, `/user-ban`, `/user-unban`
- Reactions: `/reaction-mode`, `/reaction-permissions`
- Bots: `/bot-allow`, `/bot-deny`, `/bot-list`
- Webhooks: `/webhook-allow`, `/webhook-deny`, `/webhook-list`
- Ignore rules: `/ignore-add`, `/ignore-remove`, `/ignore-list`, `/ignore-channel`, `/ignore-channel-remove`
- Server: `/server-language`, `/server-style`, `/server-settings`, `/bot-locale`, `/command-permissions`
- Information: `/stats`, `/status`, `/version`, `/invite`, `/help`
- Optional: `/tts` (disabled unless `ENABLE_TTS=true`; no synthetic audio is claimed without a provider)

Language options use autocomplete because Discord limits fixed choices to 25. Manual `/translate` accepts comma-separated targets. Flag reactions DM the reacting user by default; 🌐 detects language. Protect inline text with `{{protect:exact text}}`; code, URLs, mentions, emojis, timestamps, and configured ignore terms are protected automatically. End a message with `--i`, `--ignore`, or `--notranslate` to skip automatic translation.

## Security and privacy

Provider prompts explicitly treat messages as untrusted data. Collision-resistant placeholders protect Discord tokens and code and are validated after translation. Logs redact secrets and provider errors are sanitized before user display. Output suppresses repeated mentions. Input length, language names, concurrency, provider timeouts, and access rules are bounded. The bot stores IDs, configuration, mappings, cache entries, aggregate usage metadata, and managed webhook credentials in Neon; it does not store full messages for analytics. Protect Neon and Wispbyte access accordingly.

## Testing

`npm test` uses provider mocks and requires no API keys. Request-count tests prove that 15 targets use one successful Gemini call, complete fallback uses one Gemini plus one Groq call, partial fallback sends only missing targets, cache hits reduce the provider batch, cooldown skips Gemini, and a timeout does not cause a same-provider retry. Other tests cover protected tokens, 100+ languages, ignore rules, and safe splitting.

## Troubleshooting

- Commands missing: set `DISCORD_GUILD_ID`, run `npm run deploy:commands`, and wait for Discord global propagation if deploying globally.
- No message translation: enable Message Content Intent and confirm channel visibility/history/send permissions.
- Webhook mirroring unavailable: grant Manage Webhooks in destination channels.
- Database connection errors: confirm pooled/direct Neon URLs, SSL parameters, and run `npm run db:deploy`.
- Provider unavailable: inspect sanitized logs and `/status`; verify key restrictions/quota and model names.
- DMs fail: users can disable DMs; choose `/reaction-mode mode:channel`.

## Known limitations

Discord and provider language-variant support differs, so a provider may normalize a regional variant. Binary attachments are linked, not translated. Very long translated messages are split around whitespace but pathological Markdown may require Discord-side visual cleanup. Reply mapping falls back to ordinary output when a mapped destination reply cannot be resolved. TTS intentionally has no audio provider. Live acceptance requires real Discord, Neon, and provider credentials and cannot be exercised by unit tests.
