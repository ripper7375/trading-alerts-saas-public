/**
 * @jest-environment node
 */

/**
 * The intake path keeps its own copy of the trader types and styles (a pure file imports
 * its siblings only), so this test is what keeps the copy equal to Engine 4's, and what
 * ties the six-field profile projection to the engine's eight fields (finding F11).
 */

import {
  PROFILE_DEFAULTS,
  TRADER_TYPES as ENGINE_TRADER_TYPES,
  TRADING_STYLES as ENGINE_TRADING_STYLES,
} from '@/lib/engine4';
import {
  FORBIDDEN_PACKET_KEY,
  TRADER_TYPES,
  TRADING_STYLES,
  validatePacket,
} from '@/lib/intake';

import { GOLDENS, packetFromGolden } from './helpers/packets';

const snake = (key: string): string =>
  key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

describe('the intake path and Engine 4', () => {
  it('agree on the trader types and the trading styles', () => {
    expect([...TRADER_TYPES].sort()).toEqual([...ENGINE_TRADER_TYPES].sort());
    expect([...TRADING_STYLES].sort()).toEqual(
      [...ENGINE_TRADING_STYLES].sort()
    );
  });

  it('carry six of the engine’s eight profile fields, and the two left out are exactly the ones the key rule names', () => {
    const engineFields = Object.keys(PROFILE_DEFAULTS);
    expect(engineFields).toHaveLength(8);
    const left = engineFields.filter((key) => FORBIDDEN_PACKET_KEY.test(key));
    expect(left.sort()).toEqual(['commission', 'equity']);
    const packet = packetFromGolden(GOLDENS[0] as never);
    expect(Object.keys(packet.profile).sort()).toEqual(
      engineFields
        .filter((key) => !left.includes(key))
        .map(snake)
        .sort()
    );
  });

  it('refuse each of the engine’s own field names for them, in both spellings', () => {
    const packet = JSON.parse(
      JSON.stringify(packetFromGolden(GOLDENS[0] as never))
    );
    for (const key of ['equity', 'commission']) {
      packet.profile[key] = PROFILE_DEFAULTS[key as 'equity' | 'commission'];
      expect(validatePacket(packet).ok).toBe(false);
      delete packet.profile[key];
    }
    expect(validatePacket(packet).ok).toBe(true);
  });

  it('do not mistake any of the six fields that are carried for the two that are not', () => {
    for (const key of Object.keys(PROFILE_DEFAULTS)) {
      if (key === 'equity' || key === 'commission') continue;
      expect(FORBIDDEN_PACKET_KEY.test(key)).toBe(false);
      expect(FORBIDDEN_PACKET_KEY.test(snake(key))).toBe(false);
    }
  });
});
