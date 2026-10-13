/**
 * @jest-environment node
 */

/**
 * The whole intake path over the 16 signed-off golden cycles (build step 6 part 5): every cycle,
 * both trader types, every intent that makes a packet, the two instant prompts, and the question
 * that is out of scope, with the FIXTURE Understand adapter (recorded answers, no model).
 *
 * Nothing is invented. The sensors, the synthesis readings and the zones are the stored ones the
 * worker wrote and Davin approved; the snapshot reader, the board, the router and the packet
 * assembly are the real code. A packet that comes out is checked against the stored files it was
 * made from, and against the rules that matter most (architecture 4.11 items 1, 2, 4 and 10).
 */

import {
  canonicalSha256,
  forbiddenKeyPaths,
  validatePacket,
  type IntakePacket,
  type PacketIntent,
  type TraderType,
} from '@/lib/intake';
import {
  createFixtureUnderstand,
  type FixtureRecording,
} from '@/lib/intake/text/understand-fixture';

import { echoResult, instant, profileFor, run, typed } from './helpers/ports';
import { goldenWorlds, storedWorlds, type World } from './helpers/world';

const TYPED_INTENTS = [
  'DIRECTION',
  'ENTRY_TIMING',
  'EXIT_TARGETS',
  'RISK_SIZING',
  'EXPLAIN',
  'NEWS',
  'REPORT_2',
] as const;

const QUESTION: Record<
  (typeof TYPED_INTENTS)[number] | 'OUT_OF_SCOPE',
  string
> = {
  DIRECTION: 'Should I buy or sell gold now',
  ENTRY_TIMING: 'Where should I enter gold',
  EXIT_TARGETS: 'Where should I take profit on gold',
  RISK_SIZING: 'How big should my gold position be',
  EXPLAIN: 'What is UOEDT on the M15 chart',
  NEWS: 'Is there big news for gold today',
  REPORT_2: 'Make the trade setup for gold',
  OUT_OF_SCOPE: 'Where will EURUSD go',
};

/** The recorded answers: what a model returned for each question. */
const RECORDINGS: FixtureRecording[] = [
  ...TYPED_INTENTS.map((intent) => ({
    question: QUESTION[intent],
    output: echoResult(QUESTION[intent], intent, {
      timeframes: intent === 'EXPLAIN' ? ['M15'] : [],
    }),
  })),
  {
    question: QUESTION.OUT_OF_SCOPE,
    output: echoResult(QUESTION.OUT_OF_SCOPE, 'DIRECTION', {
      symbols: ['EURUSD'],
    }),
  },
];

const TRADERS: TraderType[] = ['DAY_TRADER', 'SCALPER'];
const GOLDEN = goldenWorlds();

function packetOf(result: { kind: string }): IntakePacket {
  if (result.kind !== 'PACKET')
    throw new Error(`expected a packet, got ${result.kind}`);
  return (result as unknown as { packet: IntakePacket }).packet;
}

const boardIds = (world: World): string[] =>
  world.sensors
    .map((s) => s.mcd_id)
    .filter((id) => id !== 'MCD0')
    .sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)));

describe('the golden cycles', () => {
  it('are the sixteen the worker signed off', () => {
    expect(GOLDEN).toHaveLength(16);
    expect(storedWorlds()).toHaveLength(3);
  });
});

describe.each(GOLDEN.map((world) => [world.name, world] as const))(
  'golden %s',
  (_name, world) => {
    describe.each(TRADERS)('%s', (trader) => {
      const packets = new Map<string, IntakePacket>();

      beforeAll(async () => {
        for (const intent of TYPED_INTENTS) {
          const fixture = createFixtureUnderstand(RECORDINGS);
          const { result, fake } = await run(typed(QUESTION[intent]), {
            world,
            profile: profileFor(trader),
            understand: fixture,
          });
          expect(fixture.calls).toHaveLength(1);
          expect(fake.calls.understand).toBe(1);
          packets.set(intent, packetOf(result));
        }
        for (const label of [
          'INSTANT_M5_INSPECT',
          'INSTANT_M15_INSPECT',
        ] as const) {
          const { result, fake } = await run(instant(label), {
            world,
            profile: profileFor(trader),
          });
          expect(fake.calls.understand).toBe(0);
          packets.set(label, packetOf(result));
        }
      });

      it('makes a packet for every intent that has one, each accepted by the validator', () => {
        expect([...packets.keys()].sort()).toEqual(
          [...TYPED_INTENTS, 'INSTANT_M5_INSPECT', 'INSTANT_M15_INSPECT'].sort()
        );
        for (const packet of packets.values()) {
          // through JSON and back, as the route sends it
          const sent = JSON.parse(JSON.stringify(packet)) as unknown;
          expect(validatePacket(sent).ok).toBe(true);
        }
      });

      it('pins every packet to the cycle and carries the whole board (4.11 item 1)', () => {
        for (const packet of packets.values()) {
          expect(packet.data.cycle_slot).toBe(world.slotIso);
          expect(packet.data.status).toBe('FRESH');
          expect(packet.board.sensors.map((s) => s.mcd_id)).toEqual(
            boardIds(world)
          );
          expect(packet.profile.trader_type).toBe(trader);
        }
      });

      it('gives the sensors of M* in full, byte for byte as the worker stored them', () => {
        for (const packet of packets.values()) {
          for (const reading of packet.readings.sensors) {
            const stored = world.sensors.find(
              (s) => s.mcd_id === reading.mcd_id
            )!;
            expect(reading.envelope_sha256).toBe(stored.envelope_sha256);
            expect(reading.envelope).toEqual(JSON.parse(stored.envelope_json));
          }
          expect(packet.readings.m_star).toEqual(
            packet.readings.sensors.map((s) => s.mcd_id)
          );
        }
      });

      it('gives the trader’s own synthesis reading and zones, and none for Report 2', () => {
        const stored = world.synthesis.find((r) => r.profile === trader)!;
        for (const [intent, packet] of packets) {
          if (intent === 'REPORT_2') {
            expect(packet.readings.synthesis).toBeNull();
            expect(packet.readings.m_star).toEqual([]);
            continue;
          }
          const synthesis = packet.readings.synthesis!;
          expect(synthesis.reading_sha256).toBe(stored.reading_sha256);
          expect(synthesis.reading).toEqual(JSON.parse(stored.reading_json));
          expect(synthesis.zones_sha256).toBe(stored.zones_sha256);
          expect(synthesis.zones).toEqual(JSON.parse(stored.zones_json));
        }
      });

      it('always gives the primary sensor in full (except for Report 2), and the stand-aside and opposing ones', () => {
        const primary = trader === 'DAY_TRADER' ? 'MCD1' : 'MCD2';
        for (const [intent, packet] of packets) {
          if (intent === 'REPORT_2') continue;
          const line = packet.board.sensors.find((s) => s.mcd_id === primary);
          if (line !== undefined && line.status !== 'ABSENT') {
            expect(packet.readings.m_star).toContain(primary);
          }
          for (const sensor of packet.board.sensors) {
            if (sensor.status === 'VALID' || sensor.status === 'CAUTIONARY') {
              if (sensor.bias === 'STAND_ASIDE') {
                expect({
                  intent,
                  id: sensor.mcd_id,
                  given: packet.readings.m_star,
                }).toEqual({
                  intent,
                  id: sensor.mcd_id,
                  given: expect.arrayContaining([sensor.mcd_id]),
                });
              }
            }
          }
        }
      });

      it('gives Report 2 no knowledge pack and every other intent one that names its build', () => {
        for (const [intent, packet] of packets) {
          if (intent === 'REPORT_2') {
            expect(packet.knowledge).toBeNull();
          } else {
            expect(packet.knowledge).toMatchObject({
              status: 'OK',
              index_build_id: 'build-0001',
            });
          }
        }
      });

      it('has the question, the intent and the events its kind of request calls for', () => {
        for (const [intent, packet] of packets) {
          const instantLabel = intent.startsWith('INSTANT_');
          expect(packet.intent).toBe(intent as PacketIntent);
          expect(packet.question.source).toBe(
            instantLabel ? 'INSTANT' : 'TYPED'
          );
          expect(packet.question.original).toBe(
            instantLabel ? null : QUESTION[intent as keyof typeof QUESTION]
          );
          expect(packet.events.scope).toBe(
            intent === 'NEWS' ? 'UPCOMING_ALL' : 'NEXT_24H_HIGH'
          );
        }
      });

      it('never carries the equity or the commission, anywhere (ADR-077)', () => {
        for (const packet of packets.values()) {
          expect(forbiddenKeyPaths(packet)).toEqual([]);
          expect(JSON.stringify(packet)).not.toMatch(/equity|commission/i);
        }
      });

      it('has a trace that equals the packet’s, and a fingerprint of the whole packet (4.11 item 10)', async () => {
        for (const intent of [
          ...TYPED_INTENTS,
          'INSTANT_M5_INSPECT',
          'INSTANT_M15_INSPECT',
        ] as const) {
          const request = intent.startsWith('INSTANT_')
            ? instant(intent as 'INSTANT_M5_INSPECT' | 'INSTANT_M15_INSPECT')
            : typed(QUESTION[intent as keyof typeof QUESTION]);
          const { result, trace } = await run(request, {
            world,
            profile: profileFor(trader),
            understand: createFixtureUnderstand(RECORDINGS),
          });
          const packet = packetOf(result);
          expect(trace).toMatchObject({
            outcome: 'PACKET',
            language: packet.trace.language,
            reply_locale: packet.trace.reply_locale,
            intent: packet.trace.intent,
            m_star: packet.trace.m_star,
            chunk_ids: packet.trace.chunk_ids,
            index_build_id: packet.trace.index_build_id,
            cycle_slot: packet.trace.cycle_slot,
            data_status: packet.trace.data_status,
            sensor_statuses: packet.trace.sensor_statuses,
            synthesis_rule: packet.trace.synthesis_rule,
            intake_version: packet.trace.intake_version,
            routing_version: packet.trace.routing_version,
          });
          expect(trace.packet_sha256).toBe(await canonicalSha256(packet));
          expect(packet).toEqual(packets.get(intent));
          expect(forbiddenKeyPaths(trace)).toEqual([]);
        }
      });

      it('is out of scope for another symbol: the fixed reply, and the snapshot never read (4.11 item 4)', async () => {
        const { result, fake } = await run(typed(QUESTION.OUT_OF_SCOPE), {
          world,
          profile: profileFor(trader),
          understand: createFixtureUnderstand(RECORDINGS),
        });
        expect(result.kind).toBe('REFUSED');
        expect(fake.calls.snapshot).toBe(0);
        expect(fake.calls.knowledge).toBe(0);
        expect(fake.calls.events).toBe(0);
      });
    });
  }
);

describe('4.11 item 2: only MCD3 says stand aside, and its full reading is still delivered (golden 01)', () => {
  const golden01 = GOLDEN[0]!;
  const stored = golden01.sensors.find((s) => s.mcd_id === 'MCD3')!;

  it.each(TRADERS)(
    '%s: MCD3’s whole envelope is in every packet that carries readings',
    async (trader) => {
      const intents = [
        ...TYPED_INTENTS.filter((i) => i !== 'REPORT_2'),
        'INSTANT_M5_INSPECT',
        'INSTANT_M15_INSPECT',
      ] as const;
      for (const intent of intents) {
        const request = intent.startsWith('INSTANT_')
          ? instant(intent as 'INSTANT_M5_INSPECT' | 'INSTANT_M15_INSPECT')
          : typed(QUESTION[intent as keyof typeof QUESTION]);
        const { result } = await run(request, {
          world: golden01,
          profile: profileFor(trader),
          understand: createFixtureUnderstand(RECORDINGS),
        });
        const packet = packetOf(result);
        const board = packet.board.sensors.map((s) => [s.mcd_id, s.bias]);
        expect(board).toEqual([
          ['MCD1', 'LONG'],
          ['MCD2', 'LONG'],
          ['MCD3', 'STAND_ASIDE'],
        ]);
        const reading = packet.readings.sensors.find(
          (s) => s.mcd_id === 'MCD3'
        )!;
        expect(reading.envelope_sha256).toBe(stored.envelope_sha256);
        expect(reading.envelope).toEqual(JSON.parse(stored.envelope_json));
      }
    }
  );
});

describe('the three stored cycles and the other data statuses', () => {
  it.each(storedWorlds().map((w) => [w.name, w] as const))(
    'stored cycle %s makes a packet for both trader types',
    async (_name, world) => {
      for (const trader of TRADERS) {
        const { result } = await run(typed(QUESTION.DIRECTION), {
          world,
          profile: profileFor(trader),
          understand: createFixtureUnderstand(RECORDINGS),
        });
        const packet = packetOf(result);
        expect(packet.data.cycle_slot).toBe(world.slotIso);
        expect(packet.board.sensors.length).toBeGreaterThan(0);
      }
    }
  );

  it.each(['FRESH', 'DELAYED', 'STALE', 'MARKET_CLOSED'] as const)(
    'golden 01 under a %s gateway answers with that status in every packet',
    async (status) => {
      for (const intent of TYPED_INTENTS) {
        const { result } = await run(typed(QUESTION[intent]), {
          world: GOLDEN[0]!,
          worldOptions: { gateway: status },
          understand: createFixtureUnderstand(RECORDINGS),
        });
        expect(packetOf(result).data.status).toBe(status);
      }
    }
  );

  it('golden 01 under a gateway that cannot be reached answers UNKNOWN in every packet', async () => {
    for (const intent of TYPED_INTENTS) {
      const { result } = await run(typed(QUESTION[intent]), {
        world: GOLDEN[0]!,
        worldOptions: { gateway: 'THROWS' },
        understand: createFixtureUnderstand(RECORDINGS),
      });
      const packet = packetOf(result);
      expect(packet.data.status).toBe('UNKNOWN');
      expect(packet.data.flags).toEqual(['GATEWAY_UNREACHABLE']);
    }
  });

  it('a retuning cycle says so in the packet', async () => {
    const { result } = await run(typed(QUESTION.DIRECTION), {
      world: GOLDEN[0]!,
      worldOptions: { retuning: true },
      understand: createFixtureUnderstand(RECORDINGS),
    });
    expect(packetOf(result).data.retuning).toBe(true);
  });
});
