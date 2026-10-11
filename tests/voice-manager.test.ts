import { describe, expect, it } from 'vitest';
import { VoiceManager } from '../src/services/voice/voice-manager.js';
import { commandData } from '../src/bot/commands/index.js';

describe('VoiceManager & VC commands', () => {
  it('initializes with empty sessions', () => {
    const vm = new VoiceManager();
    expect(vm.getAllSessions()).toEqual([]);
    expect(vm.getSession('nonexistent-guild')).toBeUndefined();
  });

  it('leave returns false when session does not exist', () => {
    const vm = new VoiceManager();
    expect(vm.leave('nonexistent-guild')).toBe(false);
  });

  it('registers vc-join, vc-leave, and vc-status commands', () => {
    const vcJoin = commandData.find((c) => c.name === 'vc-join');
    const vcLeave = commandData.find((c) => c.name === 'vc-leave');
    const vcStatus = commandData.find((c) => c.name === 'vc-status');

    expect(vcJoin).toBeDefined();
    expect(vcLeave).toBeDefined();
    expect(vcStatus).toBeDefined();

    expect(vcJoin?.description).toContain('voice');
    expect(vcLeave?.description).toContain('voice');
    expect(vcStatus?.description).toContain('voice');

    const primaryOpt = vcJoin?.options?.find((o: any) => o.name === 'primary_language');
    const secondaryOpt = vcJoin?.options?.find((o: any) => o.name === 'secondary_language');
    const subtitlesOpt = vcJoin?.options?.find((o: any) => o.name === 'subtitles');

    expect(primaryOpt?.autocomplete).toBe(true);
    expect(secondaryOpt?.autocomplete).toBe(true);
    expect(subtitlesOpt?.type).toBe(5); // Boolean option type is 5 in Discord API
  });
});
