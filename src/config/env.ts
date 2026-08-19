import { z } from 'zod';
const bool = z.string().default('false').transform(v => v.toLowerCase() === 'true');
const schema = z.object({
  DISCORD_TOKEN:z.string().min(1), DISCORD_CLIENT_ID:z.string().min(1), DISCORD_GUILD_ID:z.string().optional(),
  DATABASE_URL:z.string().min(1), DIRECT_URL:z.string().min(1), GEMINI_API_KEY:z.string().optional(), GEMINI_API_KEYS:z.string().optional(),
  GEMINI_MODEL:z.string().default('gemini-3.5-flash-lite'), GROQ_API_KEY:z.string().optional(), GROQ_MODEL:z.string().default('qwen/qwen3.6-27b'), GOOGLE_TRANSLATE_API_KEY:z.string().optional(),
  NODE_ENV:z.enum(['development','test','production']).default('production'), LOG_LEVEL:z.string().default('info'), BOT_VERSION:z.string().default('1.0.0'),
  TRANSLATION_TIMEOUT_MS:z.coerce.number().int().positive().default(10000), TRANSLATION_MAX_RETRIES:z.coerce.number().int().min(0).default(0),
  GEMINI_TIMEOUT_MS:z.coerce.number().int().positive().optional(), GROQ_TIMEOUT_MS:z.coerce.number().int().positive().optional(), GOOGLE_TRANSLATE_TIMEOUT_MS:z.coerce.number().int().positive().optional(), GEMINI_COOLDOWN_SECONDS:z.coerce.number().int().positive().default(60),
  MAX_TRANSLATION_BATCH_SIZE:z.coerce.number().int().positive().max(15).default(15), MAX_TRANSLATION_CONCURRENCY:z.coerce.number().int().positive().default(5), MAX_TARGET_LANGUAGES:z.coerce.number().int().positive().max(15).default(15),
  ENABLE_TRANSLATION_CACHE:bool.default('true'), TRANSLATION_CACHE_TTL_SECONDS:z.coerce.number().int().positive().default(86400), MEMORY_CACHE_MAX_ENTRIES:z.coerce.number().int().positive().default(1000), ENABLE_TTS:bool
});
export type Env = z.infer<typeof schema>;
export function loadEnv(source:NodeJS.ProcessEnv=process.env):Env { const parsed=schema.safeParse(source); if(!parsed.success) throw new Error(`Invalid environment configuration: ${parsed.error.issues.map(i=>i.path.join('.')+': '+i.message).join('; ')}`); return parsed.data; }
