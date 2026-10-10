/**
 * @jest-environment node
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  INSTANT_INTENTS,
  INTENTS,
  PACKET_INTENTS,
  UNDERSTAND_INTENTS,
  instantTimeframe,
  isInstantIntent,
  isIntent,
  isPacketIntent,
  isUnderstandIntent,
} from '@/lib/intake';

const EIGHT = [
  'DIRECTION',
  'ENTRY_TIMING',
  'EXIT_TARGETS',
  'RISK_SIZING',
  'EXPLAIN',
  'NEWS',
  'REPORT_2',
  'OUT_OF_SCOPE',
];

describe('the intent labels', () => {
  it('are the eight of ADR-037 and the two instant prompts, in this order', () => {
    expect([...UNDERSTAND_INTENTS]).toEqual(EIGHT);
    expect([...INSTANT_INTENTS]).toEqual([
      'INSTANT_M5_INSPECT',
      'INSTANT_M15_INSPECT',
    ]);
    expect([...INTENTS]).toEqual([...EIGHT, ...INSTANT_INTENTS]);
    expect(new Set(INTENTS).size).toBe(10);
  });

  it('are the rows of the dispatch matrix in architecture 4.5', () => {
    const doc = readFileSync(
      join(__dirname, '..', '..', '..', 'docs', 'STACK-D-ARCHITECTURE.md'),
      'utf8'
    );
    const start = doc.indexOf('### 4.5 Dispatch matrix');
    const end = doc.indexOf('### 4.6 ', start);
    const rows = doc
      .slice(start, end)
      .split('\n')
      .filter((line) => /^\| (?!Intent|-)/.test(line))
      .map((line) => (line.split('|')[1] ?? '').trim());
    const labels = rows.map((name) =>
      name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
    );
    expect(labels).toEqual(EIGHT);
  });

  it('keep OUT_OF_SCOPE out of a packet: that request gets a fixed reply instead', () => {
    expect(PACKET_INTENTS).toHaveLength(9);
    expect(PACKET_INTENTS).not.toContain('OUT_OF_SCOPE');
    expect([...PACKET_INTENTS]).toEqual([
      'DIRECTION',
      'ENTRY_TIMING',
      'EXIT_TARGETS',
      'RISK_SIZING',
      'EXPLAIN',
      'NEWS',
      'REPORT_2',
      'INSTANT_M5_INSPECT',
      'INSTANT_M15_INSPECT',
    ]);
  });

  it('recognise exactly their own values', () => {
    for (const label of INTENTS) {
      expect(isIntent(label)).toBe(true);
      expect(isUnderstandIntent(label)).toBe(
        label !== 'INSTANT_M5_INSPECT' && label !== 'INSTANT_M15_INSPECT'
      );
      expect(isInstantIntent(label)).toBe(label.startsWith('INSTANT_'));
      expect(isPacketIntent(label)).toBe(label !== 'OUT_OF_SCOPE');
    }
    for (const junk of [
      'direction',
      ' DIRECTION',
      'DIRECTION ',
      '',
      'INSTANT_H1_INSPECT',
      'BUY',
      null,
      undefined,
      5,
      {},
      [],
      true,
    ]) {
      expect(isIntent(junk)).toBe(false);
      expect(isUnderstandIntent(junk)).toBe(false);
      expect(isInstantIntent(junk)).toBe(false);
      expect(isPacketIntent(junk)).toBe(false);
    }
  });

  it('never let the model return an instant label', () => {
    for (const label of INSTANT_INTENTS) {
      expect(isUnderstandIntent(label)).toBe(false);
    }
  });

  it('say which chart an instant prompt is about', () => {
    expect(instantTimeframe('INSTANT_M5_INSPECT')).toBe('M5');
    expect(instantTimeframe('INSTANT_M15_INSPECT')).toBe('M15');
  });
});
