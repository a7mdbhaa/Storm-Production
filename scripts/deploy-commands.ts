import 'dotenv/config';
import { REST,Routes } from 'discord.js';
import { loadEnv } from '../src/config/env.js';
import { commandData } from '../src/bot/commands/index.js';
const env=loadEnv(),rest=new REST({version:'10'}).setToken(env.DISCORD_TOKEN),route=env.DISCORD_GUILD_ID?Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID,env.DISCORD_GUILD_ID):Routes.applicationCommands(env.DISCORD_CLIENT_ID);
const body=env.DISCORD_GUILD_ID?commandData.map(({integration_types,contexts,...rest}:any)=>rest):commandData;
await rest.put(route,{body});console.log(`Deployed ${commandData.length} commands ${env.DISCORD_GUILD_ID?'to development guild':'globally (with user-app & DM support)'}.`);
