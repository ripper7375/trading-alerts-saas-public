/**
 * The wire format: what the browser receives from `app/api/engine4/*` (build step 5,
 * part 7).
 *
 * The routes answer with JSON text in which a `Rational` is its canonical text
 * (`toJSON`) and a `bigint` is decimal text (`toJsonText`). `Wire<T>` is that
 * transformation applied to a type, so every wire type below is DERIVED from the
 * engine's own type: when the engine changes a field, the compiler points at every
 * component that reads it. Nothing here is written twice.
 *
 * `readWire` is the way back to an exact number: decimal text, or `n/d` for the
 * rare value with no finite decimal form (a third). It never goes through a
 * JavaScript number.
 *
 * Pure: type-only imports from the parts that touch a database or a session.
 *
 * @module lib/engine4/templates/wire
 */

import type { BlackoutResult } from '../blackout';
import { Rational } from '../exact';
import type {
  ModalDefinition,
  NotOfferedModal,
  OfferedModal,
} from '../modal-definition';
import type { OfferResult } from '../offer';
import type { BadgeView } from '../server/setup';
import type { ScenarioName, TraderProfile } from '../types';
import type { ValidatedSetup } from '../validate';

/** `Rational` and `bigint` become text; everything else keeps its shape. */
export type Wire<T> = T extends Rational
  ? string
  : T extends bigint
    ? string
    : T extends readonly (infer U)[]
      ? Wire<U>[]
      : T extends object
        ? { [K in keyof T]: Wire<T[K]> }
        : T;

export type WireModalDefinition = Wire<ModalDefinition>;
export type WireOfferedModal = Wire<OfferedModal>;
export type WireNotOfferedModal = Wire<NotOfferedModal>;
export type WireValidatedSetup = Wire<ValidatedSetup>;
export type WireOfferResult = Wire<OfferResult>;
export type WireBlackoutResult = Wire<BlackoutResult>;
export type WireBadgeView = Wire<BadgeView>;

export type WirePill = WireOfferedModal['pills'][number];
export type WireStopChoices = WirePill['stop'];
export type WireStopOption = WireStopChoices['structural'][number];
export type WireLevel = WireStopOption['level'];
export type WireEntryBounds = WireOfferedModal['custom']['entry'];
export type WireScenario = NonNullable<
  WireValidatedSetup['scenarios']
>['scenarios'][number];
export type WireCheck = WireValidatedSetup['checks'][number];

export type ConsentAction = 'ACCEPT' | 'MODIFY' | 'DECLINE';

/** `POST /api/engine4/offer` */
export interface WireOfferAnswer {
  success: true;
  /** the cycle every later call names (unix seconds as text) */
  cycleSlot: string | null;
  offer: WireOfferResult;
  modal: WireModalDefinition;
  blackout: WireBlackoutResult;
  profile: TraderProfile;
  synthesisFlag: string | null;
}

/** `POST /api/engine4/size` */
export interface WireSizeAnswer {
  success: true;
  setup: WireValidatedSetup;
  /** SHA-256 of the setup as shown: `consent` hands it back */
  setupSha256: string;
  badge: WireBadgeView;
  offer: WireOfferResult;
}

/** `POST /api/engine4/consent` */
export interface WireConsentAnswer {
  success: true;
  duplicate: boolean;
  consent: {
    id: string;
    action: ConsentAction;
    recordedAt: string;
    setupSha256: string;
    cycleSlot: string;
  };
}

/** Every refusal of every route. */
export interface WireError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type { ScenarioName };

const FRACTION = /^(-?\d+)\/(\d+)$/;

/** The exact number a wire value stands for: decimal text, or `n/d`. */
export function readWire(text: string): Rational {
  const fraction = FRACTION.exec(text);
  if (fraction === null) return Rational.of(text);
  return Rational.fromFraction(
    BigInt(fraction[1] as string),
    BigInt(fraction[2] as string)
  );
}

/** A wire value to decimal text rounded to `places` (half away from zero), exact. */
export function wireDecimal(text: string, places: number): string {
  return readWire(text).toDecimal(places);
}
