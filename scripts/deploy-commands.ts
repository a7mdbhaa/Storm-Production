import 'dotenv/config';
import { REST,Routes } from 'discord.js';
import { loadEnv } from '../src/config/env.js';
import { commandData } from '../src/bot/commands/index.js';
const env=loadEnv(),rest=new REST({version:'10'}).setToken(env.DISCORD_TOKEN),route=env.DISCORD_GUILD_ID?Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID,env.DISCORD_GUILD_ID):Routes.applicationCommands(env.DISCORD_CLIENT_ID);
await rest.put(route,{body:commandData});console.log(`Deployed ${commandData.length} commands ${env.DISCORD_GUILD_ID?'to development guild':'globally'}.`);
