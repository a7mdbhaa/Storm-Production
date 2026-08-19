import pino from 'pino';
const redact = ['DISCORD_TOKEN', 'DATABASE_URL', 'DIRECT_URL', 'GEMINI_API_KEY', 'GEMINI_API_KEYS', 'GROQ_API_KEY', 'GOOGLE_TRANSLATE_API_KEY', 'token', 'authorization', 'req.headers.authorization'];
export const logger = pino({ level: process.env.LOG_LEVEL ?? 'info', redact: { paths: redact, censor: '[REDACTED]' } });
//# sourceMappingURL=logger.js.map