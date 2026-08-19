import 'dotenv/config';
import { loadEnv } from './config/env.js';
import { prisma,withDbRetry } from './database/prisma.js';
import { createClient,registerEvents } from './app.js';
import { TranslationCache } from './services/translation/translation-cache.js';
import { TranslationManager } from './services/translation/translation-manager.js';
import { GeminiTranslationProvider } from './services/translation/providers/gemini.js';
import { GroqTranslationProvider } from './services/translation/providers/groq.js';
import { GoogleTranslationProvider } from './services/translation/providers/google-translate.js';
import { SettingsCache } from './services/discord/settings-cache.js';
import { logger } from './utils/logger.js';
const env=loadEnv(),client=createClient(),cache=new TranslationCache(prisma,env),settingsCache=new SettingsCache(prisma),translation=new TranslationManager([new GeminiTranslationProvider(env),new GroqTranslationProvider(env),new GoogleTranslationProvider(env)],cache,env),context={client,db:prisma,env,translation,settingsCache};
registerEvents(context);
async function start(){await withDbRetry(()=>prisma.$connect());logger.info('Database: Neon PostgreSQL connected');await client.login(env.DISCORD_TOKEN);}
let stopping=false;async function shutdown(signal:string){if(stopping)return;stopping=true;logger.info({signal},'Graceful shutdown');client.destroy();await prisma.$disconnect();process.exit(0);}process.on('SIGINT',()=>void shutdown('SIGINT'));process.on('SIGTERM',()=>void shutdown('SIGTERM'));process.on('unhandledRejection',e=>logger.error({error:e instanceof Error?e.message:String(e)},'Unhandled rejection'));process.on('uncaughtException',e=>logger.fatal({error:e.message},'Uncaught exception'));
start().catch(e=>{logger.fatal({error:e instanceof Error?e.message:'unknown'},'Startup failed');process.exitCode=1;});
