import 'dotenv/config';
import { REST,Routes } from 'discord.js';
import { loadEnv } from '../src/config/env.js';
import { commandData } from '../src/bot/commands/index.js';
const env=loadEnv(),rest=new REST({version:'10'}).setToken(env.DISCORD_TOKEN);
if(env.DISCORD_GUILD_ID){
 try{await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID,env.DISCORD_GUILD_ID),{body:[]});console.log(`🧹 Cleared duplicate guild commands from server ${env.DISCORD_GUILD_ID}.`);}catch(e:any){console.warn('Warning: Could not clear guild commands:',e.message);}
}
await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID),{body:commandData});
console.log(`✅ Successfully deployed ${commandData.length} commands globally with User-App and DM support!`);
console.log(`\n👉 One-Click Link to install bot to your Discord user:\nhttps://discord.com/oauth2/authorize?client_id=${env.DISCORD_CLIENT_ID}&integration_type=1&scope=applications.commands\n`);
