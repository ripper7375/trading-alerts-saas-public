/**
 * The ledger store seen as the meter's `LedgerPort` (build step 7 part 6).
 *
 * `lib/reply/meter/` is pure and cannot import the platform, so it asks for a port; this is the
 * port, over `ledger-store.ts` and the UTC month of `period.ts`. It adds nothing of its own: it
 * turns the instant into the month, passes the allowance as the period's limit (the store creates
 * the row, or raises its limit), and gives the store's results back in the port's words. A month
 * with no row yet has the whole allowance as its balance.
 *
 * @module lib/platform/metering/ledger-port
 */

import type {
  Balance as MeterBalance,
  LedgerPort,
  ReservationState,
} from '@/lib/reply/meter/quota-port';

import {
  balanceOf,
  readPeriod,
  releaseReservation,
  reserveUnits,
  settleReservation,
  type LedgerStoreOptions,
} from './ledger-store';
import { monthOf } from './period';

const BAD_INPUT = { ok: false, code: 'BAD_INPUT' } as const;

const balanceFrom = (balance: MeterBalance): MeterBalance => ({
  limit: balance.limit,
  used: balance.used,
  reserved: balance.reserved,
  available: balance.available,
});

/** The meter's port over the database. A test passes its own client through `options`. */
export function createLedgerPort(options: LedgerStoreOptions = {}): LedgerPort {
  return {
    async balance({ userId, nowMs, allowanceUnits }) {
      const month = monthOf(nowMs);
      const period =
        month === null ? null : await readPeriod(userId, month, options);
      // the allowance applies at once when it was raised, and from next month when it was lowered
      return balanceOf({
        limit: Math.max(period?.limit ?? 0, allowanceUnits),
        used: period?.used ?? 0,
        reserved: period?.reserved ?? 0,
      });
    },

    async reserve(query) {
      const month = monthOf(query.nowMs);
      if (month === null) return BAD_INPUT;
      const result = await reserveUnits(
        {
          requestId: query.requestId,
          userId: query.userId,
          month,
          limit: query.allowanceUnits,
          units: query.units,
          nowMs: query.nowMs,
          expiresAtMs: query.expiresAtMs,
        },
        options
      );
      if (result.ok) {
        return {
          ok: true,
          replayed: result.replayed,
          status: result.reservation.status as ReservationState,
          reservedUnits: result.reservation.reserved_units,
          balance: result.balance === null ? null : balanceFrom(result.balance),
        };
      }
      switch (result.code) {
        case 'INSUFFICIENT':
          return {
            ok: false,
            code: 'INSUFFICIENT',
            balance: balanceFrom(result.balance),
          };
        case 'REQUEST_ID_TAKEN':
        case 'USER_NOT_FOUND':
          return { ok: false, code: result.code };
        default:
          return BAD_INPUT;
      }
    },

    async settle(query) {
      const result = await settleReservation(
        {
          requestId: query.requestId,
          userId: query.userId,
          actualUnits: query.actualUnits,
          costMicroUsd: query.costMicroUsd,
          model: query.model,
          promptTokens: query.promptTokens,
          completionTokens: query.completionTokens,
          nowMs: query.nowMs,
        },
        options
      );
      if (result.ok) {
        return {
          ok: true,
          replayed: result.replayed,
          chargedUnits: result.reservation.actual_units ?? 0,
          absorbedUnits: result.absorbedUnits,
          balance: result.balance === null ? null : balanceFrom(result.balance),
        };
      }
      // BAD_INPUT, NOT_FOUND or ALREADY_RELEASED: the code is the port's own word
      return { ok: false, code: result.code };
    },

    async release(query) {
      const result = await releaseReservation(
        {
          requestId: query.requestId,
          userId: query.userId,
          nowMs: query.nowMs,
        },
        options
      );
      if (result.ok) {
        return {
          ok: true,
          changed: result.changed,
          status: result.reservation.status as ReservationState,
        };
      }
      // BAD_INPUT, NOT_FOUND or ALREADY_RELEASED: the code is the port's own word
      return { ok: false, code: result.code };
    },
  };
}
