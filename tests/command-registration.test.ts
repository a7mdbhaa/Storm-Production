import {describe,it,expect} from 'vitest';
import {commandData} from '../src/bot/commands/index.js';
describe('Discord command registration schema',()=>{it('places every required option before optional options',()=>{for(const command of commandData){let optionalSeen=false;for(const option of command.options??[]){if(!option.required)optionalSeen=true;expect(option.required&&optionalSeen,`${command.name}.${option.name} is required after an optional option`).toBe(false);}}});});
