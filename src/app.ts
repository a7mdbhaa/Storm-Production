import { ActivityType,Client,Events,GatewayIntentBits,MessageFlags,Partials,type Interaction } from 'discord.js';
import type { PrismaClient } from '@prisma/client';
import type { Env } from './config/env.js';
import type { TranslationManager } from './services/translation/translation-manager.js';
import type { SettingsCache } from './services/discord/settings-cache.js';
import { autocomplete,executeCommand } from './bot/commands/index.js';
import { onMessage,onMessageDelete,onMessageUpdate } from './services/discord/automatic-translation.js';
import { onReaction } from './services/discord/reactions.js';
import { logger } from './utils/logger.js';
export interface AppContext{client:Client;db:PrismaClient;env:Env;translation:TranslationManager;settingsCache?:SettingsCache}
export function createClient(){return new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildMessageReactions],partials:[Partials.Message,Partials.Channel,Partials.Reaction]});}
export function registerEvents(c:AppContext){c.client.once(Events.ClientReady,client=>{client.user.setActivity('multilingual conversations',{type:ActivityType.Watching});logger.info({guilds:client.guilds.cache.size},'Discord connected; bot ready');});c.client.on(Events.InteractionCreate,async(i:Interaction)=>{try{if(i.isAutocomplete())await autocomplete(i);else if(i.isChatInputCommand())await executeCommand(i,c);}catch(e){logger.error({error:e instanceof Error?e.message:'unknown'},'Interaction failed');if(i.isRepliable()){const content=e instanceof Error?e.message:'An unexpected error occurred.';if(i.deferred||i.replied)await i.followUp({content,flags:MessageFlags.Ephemeral}).catch(()=>undefined);else await i.reply({content,flags:MessageFlags.Ephemeral}).catch(()=>undefined);}}});c.client.on(Events.MessageCreate,m=>void onMessage(m,c));c.client.on(Events.MessageUpdate,(a,b)=>void onMessageUpdate(a as any,b as any,c));c.client.on(Events.MessageDelete,m=>void onMessageDelete(m as any,c));c.client.on(Events.MessageReactionAdd,(r,u)=>void onReaction(r as any,u,c));}
