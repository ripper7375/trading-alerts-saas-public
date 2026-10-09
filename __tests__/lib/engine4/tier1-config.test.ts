/**
 * @jest-environment node
 */

/**
 * The Tier-1 config and its JSON schema (build step 5, part 3; ADR-060).
 *
 * `parseTier1List` is the one reader of `config/engine4/tier1-events.json`. The
 * schema file beside it says the same thing for people and editors; there is no
 * schema validator in the repository, so this test keeps the two in step by
 * running the parser against everything the schema states.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  TIER1_KINDS,
  TIER1_SCHEMA_VERSION,
  parseTier1List,
} from '@/lib/engine4';

const DIR = join(__dirname, '..', '..', '..', 'config', 'engine4');
const read = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(DIR, name), 'utf8')) as Record<string, unknown>;

const config = read('tier1-events.json');
const schema = read('tier1-events.schema.json') as {
  type: string;
  additionalProperties: boolean;
  required: string[];
  properties: Record<string, Record<string, unknown>>;
};
const entrySchema = (
  schema.properties['events'] as unknown as {
    items: {
      additionalProperties: boolean;
      required: string[];
      properties: Record<string, Record<string, unknown>>;
    };
  }
).items;

const entry = {
  eventId: '900000001',
  kind: 'CPI',
  name: 'TEST CPI',
};
const good = {
  schemaVersion: 1,
  listVersion: 2,
  description: 'x',
  events: [entry],
};

describe('the shipped config', () => {
  test('is valid', () => {
    expect(parseTier1List(config).ok).toBe(true);
  });

  test('ships EMPTY: the real event ids come from production (D13), so the blackout fails closed', () => {
    expect(config['events']).toEqual([]);
  });

  test('is at version 1 of schema 1', () => {
    expect(config['schemaVersion']).toBe(TIER1_SCHEMA_VERSION);
    expect(config['listVersion']).toBe(1);
  });

  test('points at the schema beside it', () => {
    expect(config['$schema']).toBe('./tier1-events.schema.json');
    expect(() => read('tier1-events.schema.json')).not.toThrow();
  });

  test('explains how to fill it', () => {
    const text = String(config['description']);
    expect(text).toContain('eventId');
    expect(text).toContain('listVersion');
    for (const kind of TIER1_KINDS) expect(text).toContain(kind);
  });
});

describe('the schema says what the parser accepts', () => {
  test('an object that allows no other key, requiring the three that matter', () => {
    expect(schema.type).toBe('object');
    expect(schema.additionalProperties).toBe(false);
    expect([...schema.required].sort()).toEqual([
      'events',
      'listVersion',
      'schemaVersion',
    ]);
  });

  test('the parser takes every key the schema names, and no other', () => {
    expect(Object.keys(schema.properties).sort()).toEqual([
      '$schema',
      'description',
      'events',
      'listVersion',
      'schemaVersion',
    ]);
    const all = { $schema: './x.json', ...good };
    expect(parseTier1List(all).ok).toBe(true);
    expect(parseTier1List({ ...all, other: 1 }).ok).toBe(false);
  });

  test.each(['schemaVersion', 'listVersion', 'events'])(
    '%s is required by both',
    (key) => {
      expect(schema.required).toContain(key);
      const without: Record<string, unknown> = { ...good };
      delete without[key];
      expect(parseTier1List(without).ok).toBe(false);
    }
  );

  test.each(['$schema', 'description'])('%s is optional in both', (key) => {
    expect(schema.required).not.toContain(key);
    const without: Record<string, unknown> = { ...good, $schema: 'x' };
    delete without[key];
    expect(parseTier1List(without).ok).toBe(true);
  });

  test('schemaVersion is the constant the code reads', () => {
    expect(schema.properties['schemaVersion']).toEqual({
      const: TIER1_SCHEMA_VERSION,
    });
  });

  test('listVersion is a whole number from 1', () => {
    expect(schema.properties['listVersion']).toMatchObject({
      type: 'integer',
      minimum: 1,
    });
    expect(parseTier1List({ ...good, listVersion: 1 }).ok).toBe(true);
    expect(parseTier1List({ ...good, listVersion: 0 }).ok).toBe(false);
    expect(parseTier1List({ ...good, listVersion: 1.5 }).ok).toBe(false);
  });

  describe('an event', () => {
    test('requires its three keys and allows no other', () => {
      expect(entrySchema.additionalProperties).toBe(false);
      expect([...entrySchema.required].sort()).toEqual([
        'eventId',
        'kind',
        'name',
      ]);
      expect(Object.keys(entrySchema.properties).sort()).toEqual([
        'eventId',
        'kind',
        'name',
      ]);
      for (const key of entrySchema.required) {
        const without: Record<string, unknown> = { ...entry };
        delete without[key];
        expect(parseTier1List({ ...good, events: [without] }).ok).toBe(false);
      }
      expect(
        parseTier1List({ ...good, events: [{ ...entry, other: 1 }] }).ok
      ).toBe(false);
    });

    test('its kinds are the four the code knows', () => {
      expect(entrySchema.properties['kind']).toEqual({
        enum: [...TIER1_KINDS],
      });
      for (const kind of TIER1_KINDS) {
        expect(
          parseTier1List({ ...good, events: [{ ...entry, kind }] }).ok
        ).toBe(true);
      }
      expect(
        parseTier1List({ ...good, events: [{ ...entry, kind: 'GDP' }] }).ok
      ).toBe(false);
    });

    test('its id pattern and the parser agree on every sample', () => {
      const pattern = new RegExp(
        String(entrySchema.properties['eventId']?.['pattern'])
      );
      const samples = [
        '',
        '0',
        '840010013',
        '9'.repeat(20),
        '9'.repeat(21),
        'a1',
        '1a',
        ' 1',
        '1 ',
        '1\n',
        '-1',
        '1.5',
        '١٢٣',
      ];
      for (const eventId of samples) {
        expect({
          eventId,
          parsed: parseTier1List({ ...good, events: [{ ...entry, eventId }] })
            .ok,
        }).toEqual({ eventId, parsed: pattern.test(eventId) });
      }
    });

    test('its name pattern and the parser agree on every sample', () => {
      const pattern = new RegExp(
        String(entrySchema.properties['name']?.['pattern'])
      );
      expect(entrySchema.properties['name']?.['minLength']).toBe(1);
      for (const name of ['', ' ', '\t', 'x', ' x ', 'US CPI m/m']) {
        expect({
          name,
          parsed: parseTier1List({ ...good, events: [{ ...entry, name }] }).ok,
        }).toEqual({ name, parsed: name.length >= 1 && pattern.test(name) });
      }
    });
  });
});
