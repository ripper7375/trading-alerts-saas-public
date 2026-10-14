/**
 * @jest-environment node
 */

import { INSTANT_INTENTS, PACKET_INTENTS } from '@/lib/intake';
import {
  INTENTS_ALLOWED_ON_STALE,
  SHAPE_OF_INTENT,
} from '@/lib/reply/contracts/intent-shapes';
import { REPLY_SHAPES } from '@/lib/reply/contracts/trace-fields';

const intentsWith = (shape: string): string[] =>
  Object.entries(SHAPE_OF_INTENT)
    .filter(([, value]) => value === shape)
    .map(([intent]) => intent)
    .sort();

describe('which shape the model writes for each intent (decision D9)', () => {
  it('names every intent a packet can carry, and nothing else', () => {
    expect(Object.keys(SHAPE_OF_INTENT).sort()).toEqual(
      [...PACKET_INTENTS].sort()
    );
    expect(Object.keys(SHAPE_OF_INTENT)).toHaveLength(9);
  });

  it('uses only shapes the trace knows', () => {
    for (const shape of Object.values(SHAPE_OF_INTENT)) {
      expect(REPLY_SHAPES).toContain(shape);
    }
  });

  it('gives a full analysis to direction, entry and the two instant prompts', () => {
    expect(intentsWith('REPORT1')).toEqual(
      [
        'DIRECTION',
        'ENTRY_TIMING',
        'INSTANT_M5_INSPECT',
        'INSTANT_M15_INSPECT',
      ].sort()
    );
    for (const intent of INSTANT_INTENTS) {
      expect(SHAPE_OF_INTENT[intent]).toBe('REPORT1');
    }
  });

  it('gives a short answer to targets, sizing, explanations and news', () => {
    expect(intentsWith('ANSWER')).toEqual(
      ['EXIT_TARGETS', 'EXPLAIN', 'NEWS', 'RISK_SIZING'].sort()
    );
  });

  it('calls no model for Report 2: it opens the Trade Setup modal', () => {
    expect(intentsWith('NONE')).toEqual(['REPORT_2']);
  });
});

describe('what is answered on a STALE cycle', () => {
  it('is Explain, and News (the calendar has its own status)', () => {
    expect([...INTENTS_ALLOWED_ON_STALE]).toEqual(['EXPLAIN', 'NEWS']);
  });

  it('only ever lists intents that get a model answer, never a full analysis with a direction', () => {
    for (const intent of INTENTS_ALLOWED_ON_STALE) {
      expect(PACKET_INTENTS).toContain(intent);
      expect(SHAPE_OF_INTENT[intent]).toBe('ANSWER');
    }
  });
});
