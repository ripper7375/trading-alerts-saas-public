/**
 * Test support for the answer gate, the chart rule and Report 1 assembly (build step 7 part 5):
 * the signed-off golden cycles as packets with a data-status overlay, a well-formed `report1.v1`
 * for any of them, and the frame every result needs.
 *
 * Nothing here invents market data. The packets are the 16 golden cycles through the intake
 * helper; an OVERLAY changes only what the gateway's live answer decides (the data status, the
 * retuning flag, the flags), never a cycle, exactly as plan finding S7-F17 describes.
 */

import { deriveTrace } from '@/lib/intake';
import { addressableIds } from '@/lib/reply/checks/value-dictionary';
import type { ValueDictionary } from '@/lib/reply/checks/value-dictionary';
import type {
  DataFlag,
  DataStatus,
  IntakePacket,
  Locale,
  PacketIntent,
  TraderType,
} from '@/lib/reply/contracts/intake';
import type { Report1Model } from '@/lib/reply/contracts/report1';
import { contextOfPacket } from '@/lib/reply/contracts/shape';
import type { ReplyContext } from '@/lib/reply/contracts/shape';
import type { ReplyFrame } from '@/lib/reply/report1/compose';

import { GOLDENS } from '../../../intake/helpers/packets';
import { goldenPacket } from '../../context/helpers/context-fixtures';
import { fixtureFor } from '../../checks/helpers/checks-fixtures';

export const GOLDEN_IDS: readonly string[] = GOLDENS.map((g) => g.id);
export const TRADER_TYPE_LIST: readonly TraderType[] = [
  'DAY_TRADER',
  'SCALPER',
];
export const STATUSES: readonly DataStatus[] = [
  'FRESH',
  'DELAYED',
  'STALE',
  'MARKET_CLOSED',
  'UNKNOWN',
];
export const INTENTS: readonly PacketIntent[] = [
  'DIRECTION',
  'ENTRY_TIMING',
  'EXIT_TARGETS',
  'RISK_SIZING',
  'EXPLAIN',
  'NEWS',
  'REPORT_2',
  'INSTANT_M5_INSPECT',
  'INSTANT_M15_INSPECT',
];

export const THREAD = 'cm0thread000000000000000001';
export const REQUEST = 'req-7f3a9c1e-0005';

export const FRAME: ReplyFrame = {
  threadId: THREAD,
  requestId: REQUEST,
  model: 'google/gemini-2.5-flash',
  promptVersion: 'prompt-1',
  regenerations: 0,
  changes: [],
  notes: [],
};

export interface Overlay {
  status?: DataStatus;
  retuning?: boolean;
  flags?: readonly DataFlag[];
  /** the locale the reply is written in */
  locale?: Locale;
}

/** A copy of a packet with the live answer of the gateway changed (the trace is derived again). */
export function overlay(packet: IntakePacket, patch: Overlay): IntakePacket {
  const copy = JSON.parse(JSON.stringify(packet)) as IntakePacket;
  if (patch.status !== undefined) copy.data.status = patch.status;
  if (patch.retuning !== undefined) copy.data.retuning = patch.retuning;
  if (patch.flags !== undefined) copy.data.flags = [...patch.flags];
  if (patch.locale !== undefined) copy.question.reply_locale = patch.locale;
  const { trace: _trace, ...body } = copy;
  void _trace;
  return {
    ...body,
    trace: deriveTrace(body, {
      intake: copy.trace.intake_version,
      routing: copy.trace.routing_version,
    }),
  };
}

/** A golden cycle's packet for an intent and a trader type. */
export function packetOf(
  id: string,
  traderType: TraderType = 'DAY_TRADER',
  intent: PacketIntent = 'DIRECTION'
): IntakePacket {
  return goldenPacket(id, { traderType, intent });
}

/** A packet, its day of bars' dictionary, for a golden cycle. */
export async function worldOf(
  id: string,
  traderType: TraderType = 'DAY_TRADER'
): Promise<{ packet: IntakePacket; dictionary: ValueDictionary }> {
  const { packet, dictionary } = await fixtureFor(id, traderType);
  return { packet, dictionary };
}

/** The context a model reply is validated against (the ids the prompt offered). */
export function contextOf(
  packet: IntakePacket,
  dictionary: ValueDictionary
): ReplyContext {
  return contextOfPacket(packet, addressableIds(dictionary));
}

/**
 * A well-formed `report1.v1` for any golden cycle: every figure is an id, every chosen zone has
 * its invalidation line, every cite is in the packet. It says nothing a model could not.
 */
export function modelReportFor(
  packet: IntakePacket,
  dictionary: ValueDictionary,
  options: { withInvalidation?: boolean } = {}
): Report1Model {
  const withInvalidation = options.withInvalidation ?? true;
  const synthesis = packet.readings.synthesis;
  const zones = (synthesis?.zones ?? []).map((zone) => String(zone['zone_id']));
  const hasLast = dictionary.byId.has('LAST_PRICE');
  const hasDay =
    dictionary.byId.has('DAY.high') && dictionary.byId.has('DAY.low');
  const sensors = packet.board.sensors.filter(
    (line) => line.state_code !== null
  );

  const rationale = sensors.slice(0, 3).map((line) => ({
    text: `${line.mcd_id} reads ${line.state_code as string}`,
    cites: [line.mcd_id],
  }));
  if (rationale.length === 0) {
    rationale.push({
      text: 'The synthesis fired its rule for this cycle',
      cites: ['SYN'],
    });
  }

  const watch = withInvalidation
    ? zones.map((zone) => ({
        text: `A close beyond {${zone}.invalidation} cancels the view for ${zone}`,
        cites: [zone],
      }))
    : [];
  if (watch.length === 0) {
    watch.push({
      text: 'A new state of the M15 channel would change the picture',
      cites: [sensors[0]?.mcd_id ?? 'SYN'],
    });
  }

  return {
    headline: hasLast
      ? hasDay
        ? 'Price near {LAST_PRICE} inside the day range {DAY.low} to {DAY.high}'
        : 'Price near {LAST_PRICE}'
      : 'No price is available for this cycle',
    zones,
    rationale,
    watch: watch.slice(0, 4),
    risks: sensors
      .filter((line) => line.status !== 'VALID')
      .slice(0, 2)
      .map((line) => ({
        text: `${line.mcd_id} is ${line.status.toLowerCase()}`,
        cites: [line.mcd_id],
      })),
  };
}
