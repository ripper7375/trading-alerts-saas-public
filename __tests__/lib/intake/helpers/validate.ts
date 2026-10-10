/**
 * What the packet tests share: one base packet (golden 01, the stored 18 Sep cycle, Day Trader),
 * ways to change a copy of it, and ways to say what the validator made of the result.
 */

import {
  validatePacket,
  type IntakePacket,
  type Issue,
  type Roster,
} from '@/lib/intake';

import { GOLDENS, clone, packetFromGolden } from './packets';
import { retrace, type Any } from './walk';

export const golden = (prefix: string) => {
  const found = GOLDENS.find((g) => g.id.startsWith(prefix));
  if (found === undefined) throw new Error(`no golden ${prefix}`);
  return found;
};

/** Golden 01: the 18 Sep cycle, all three sensors CAUTIONARY, MCD3 says stand aside. */
export const BASE: IntakePacket = packetFromGolden(golden('01'));

/** A copy of `base` changed by `change`, with the trace made again from what the packet now says. */
export function variant(
  change: (packet: Any) => void,
  base: IntakePacket = BASE
): Any {
  const packet = clone(base) as Any;
  change(packet);
  return retrace(packet);
}

/** A copy changed by `change`, the trace left alone. */
export function broken(
  change: (packet: Any) => void,
  base: IntakePacket = BASE
): Any {
  const packet = clone(base) as Any;
  change(packet);
  return packet;
}

export function issuesOf(value: unknown, roster?: Roster): Issue[] {
  const result = validatePacket(value, roster === undefined ? {} : { roster });
  if (result.ok) throw new Error('the packet was accepted');
  return result.issues;
}

/** Every issue as `path code`, in the order the validator found them. */
export function summary(value: unknown, roster?: Roster): string[] {
  return issuesOf(value, roster).map((issue) => `${issue.path} ${issue.code}`);
}

export function expectRefused(
  value: unknown,
  ...wanted: [path: string, code?: string][]
): void {
  const issues = issuesOf(value);
  for (const [path, code] of wanted) {
    expect(
      issues.some(
        (issue) =>
          issue.path === path && (code === undefined || issue.code === code)
      )
    ).toBe(true);
  }
}

export function expectAccepted(value: unknown, roster?: Roster): void {
  const result = validatePacket(value, roster === undefined ? {} : { roster });
  if (!result.ok) {
    throw new Error(
      result.issues.map((i) => `${i.path} [${i.code}] ${i.message}`).join('\n')
    );
  }
}
