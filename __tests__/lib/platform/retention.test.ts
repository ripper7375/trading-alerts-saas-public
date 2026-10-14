/**
 * @jest-environment node
 */

import {
  CHAT_RETENTION_MONTHS,
  TRACE_ARCHIVE_YEARS,
  TRACE_LIVE_DAYS,
  addUtcMonths,
  messageExpiry,
  planRetention,
  traceArchiveUntil,
} from '@/lib/platform/traces/retention';
import type { RetentionInput } from '@/lib/platform/traces/retention';

const DAY = 86_400_000;
const NOW = new Date(Date.UTC(2027, 0, 15, 12, 0, 0, 0));
const ago = (ms: number): Date => new Date(NOW.getTime() - ms);
const iso = (d: Date): string => d.toISOString();

const plan = (patch: Partial<RetentionInput>) =>
  planRetention({ now: NOW, traces: [], messages: [], ...patch });

describe('the policy numbers', () => {
  it('are the decisions of ADR-076 and D18', () => {
    expect(TRACE_LIVE_DAYS).toBe(90);
    expect(TRACE_ARCHIVE_YEARS).toBe(7);
    expect(CHAT_RETENTION_MONTHS).toBe(12);
  });
});

describe('addUtcMonths', () => {
  it.each([
    ['2026-09-18T20:55:00.000Z', 12, '2027-09-18T20:55:00.000Z'],
    ['2026-09-18T20:55:00.000Z', 0, '2026-09-18T20:55:00.000Z'],
    ['2026-09-18T20:55:00.000Z', 1, '2026-10-18T20:55:00.000Z'],
    ['2026-12-31T23:59:59.999Z', 1, '2027-01-31T23:59:59.999Z'],
    ['2026-01-31T10:00:00.000Z', 1, '2026-02-28T10:00:00.000Z'],
    ['2028-01-31T10:00:00.000Z', 1, '2028-02-29T10:00:00.000Z'],
    ['2028-02-29T10:00:00.000Z', 12, '2029-02-28T10:00:00.000Z'],
    ['2028-02-29T10:00:00.000Z', 48, '2032-02-29T10:00:00.000Z'],
    ['2026-03-31T00:00:00.000Z', -1, '2026-02-28T00:00:00.000Z'],
    ['2026-01-15T00:00:00.000Z', -2, '2025-11-15T00:00:00.000Z'],
    ['2026-11-30T08:00:00.000Z', 3, '2027-02-28T08:00:00.000Z'],
    ['2026-06-15T08:00:00.000Z', 84, '2033-06-15T08:00:00.000Z'],
  ])('%s + %d months = %s', (from, months, expected) => {
    expect(iso(addUtcMonths(new Date(from), months))).toBe(expected);
  });

  it('keeps the time of day to the millisecond', () => {
    const from = new Date(Date.UTC(2026, 4, 5, 13, 14, 15, 678));
    expect(
      addUtcMonths(from, 12).getTime() - Date.UTC(2027, 4, 5, 13, 14, 15, 678)
    ).toBe(0);
  });

  it('does not change its input', () => {
    const from = new Date('2026-01-31T10:00:00.000Z');
    addUtcMonths(from, 1);
    expect(iso(from)).toBe('2026-01-31T10:00:00.000Z');
  });
});

describe('the two dates a record is given', () => {
  it('a message expires 12 months after it was made; a trace is kept 7 years', () => {
    const made = new Date('2026-09-18T20:55:12.345Z');
    expect(iso(messageExpiry(made))).toBe('2027-09-18T20:55:12.345Z');
    expect(iso(traceArchiveUntil(made))).toBe('2033-09-18T20:55:12.345Z');
  });
});

describe('planRetention: the traces', () => {
  it('keeps a trace younger than 90 days, archived or not', () => {
    const result = plan({
      traces: [
        { requestId: 'young', createdAt: ago(10 * DAY), archivedAt: null },
        {
          requestId: 'young-archived',
          createdAt: ago(10 * DAY),
          archivedAt: ago(5 * DAY),
        },
      ],
    });
    expect(result).toEqual({
      archive: [],
      deleteLive: [],
      deleteMessages: [],
      traceKept: 2,
      problems: [],
    });
  });

  it('is at the boundary exactly at 90 days: one millisecond younger is kept, exactly 90 is due', () => {
    const just = ago(90 * DAY);
    const younger = ago(90 * DAY - 1);
    const result = plan({
      traces: [
        { requestId: 'on-the-day', createdAt: just, archivedAt: null },
        { requestId: 'a-moment-short', createdAt: younger, archivedAt: null },
      ],
    });
    expect(result.archive.map((a) => a.requestId)).toEqual(['on-the-day']);
    expect(result.traceKept).toBe(1);
  });

  it('asks for the archive of an old trace that is not archived, with its keep-until date', () => {
    const created = ago(100 * DAY);
    const result = plan({
      traces: [{ requestId: 'old', createdAt: created, archivedAt: null }],
    });
    expect(result.archive).toEqual([
      { requestId: 'old', keepUntil: traceArchiveUntil(created) },
    ]);
    expect(result.deleteLive).toEqual([]);
  });

  it('lets the live copy of an old archived trace go, and never one that is not archived', () => {
    const result = plan({
      traces: [
        {
          requestId: 'archived',
          createdAt: ago(100 * DAY),
          archivedAt: ago(5 * DAY),
        },
        {
          requestId: 'not-archived',
          createdAt: ago(1000 * DAY),
          archivedAt: null,
        },
      ],
    });
    expect(result.deleteLive).toEqual(['archived']);
    expect(result.archive.map((a) => a.requestId)).toEqual(['not-archived']);
  });

  it('never offers the deletion of a row that is not archived, whatever its age', () => {
    const traces = [1, 91, 365, 4000].map((days) => ({
      requestId: `t${days}`,
      createdAt: ago(days * DAY),
      archivedAt: null,
    }));
    expect(plan({ traces }).deleteLive).toEqual([]);
  });

  it('reports a row it cannot judge and does nothing with it', () => {
    const result = plan({
      traces: [
        {
          requestId: 'future',
          createdAt: new Date(NOW.getTime() + DAY),
          archivedAt: null,
        },
        {
          requestId: 'before',
          createdAt: ago(200 * DAY),
          archivedAt: ago(300 * DAY),
        },
        {
          requestId: 'later',
          createdAt: ago(200 * DAY),
          archivedAt: new Date(NOW.getTime() + DAY),
        },
        { requestId: 'nan', createdAt: new Date(NaN), archivedAt: null },
        {
          requestId: 'nan-archive',
          createdAt: ago(200 * DAY),
          archivedAt: new Date(NaN),
        },
      ],
    });
    expect(result.archive).toEqual([]);
    expect(result.deleteLive).toEqual([]);
    expect(result.traceKept).toBe(0);
    expect(result.problems).toEqual([
      { kind: 'TRACE', id: 'future', code: 'CREATED_IN_THE_FUTURE' },
      { kind: 'TRACE', id: 'before', code: 'ARCHIVED_BEFORE_CREATED' },
      { kind: 'TRACE', id: 'later', code: 'ARCHIVED_IN_THE_FUTURE' },
      { kind: 'TRACE', id: 'nan', code: 'INVALID_DATE' },
      { kind: 'TRACE', id: 'nan-archive', code: 'INVALID_DATE' },
    ]);
  });

  it('lists the oldest first, ties by id, and cuts each list at the limit', () => {
    const traces = [
      { requestId: 'c', createdAt: ago(100 * DAY), archivedAt: null },
      { requestId: 'a', createdAt: ago(100 * DAY), archivedAt: null },
      { requestId: 'b', createdAt: ago(200 * DAY), archivedAt: null },
      {
        requestId: 'z-archived',
        createdAt: ago(300 * DAY),
        archivedAt: ago(1 * DAY),
      },
      {
        requestId: 'y-archived',
        createdAt: ago(150 * DAY),
        archivedAt: ago(1 * DAY),
      },
    ];
    const all = plan({ traces });
    expect(all.archive.map((a) => a.requestId)).toEqual(['b', 'a', 'c']);
    expect(all.deleteLive).toEqual(['z-archived', 'y-archived']);
    const some = plan({ traces, limit: 2 });
    expect(some.archive.map((a) => a.requestId)).toEqual(['b', 'a']);
    expect(some.deleteLive).toEqual(['z-archived', 'y-archived']);
    expect(plan({ traces, limit: 1 }).deleteLive).toEqual(['z-archived']);
  });
});

describe('planRetention: the chat messages', () => {
  it('deletes a message whose expiry has come, and not one that has not', () => {
    const result = plan({
      messages: [
        { id: 'past', expiresAt: ago(1) },
        { id: 'now', expiresAt: NOW },
        { id: 'future', expiresAt: new Date(NOW.getTime() + 1) },
        { id: 'nan', expiresAt: new Date(NaN) },
      ],
    });
    expect(result.deleteMessages).toEqual(['past', 'now']);
    expect(result.problems).toEqual([
      { kind: 'MESSAGE', id: 'nan', code: 'INVALID_DATE' },
    ]);
  });

  it('lists the oldest expiry first and cuts at the limit', () => {
    const messages = [
      { id: 'm3', expiresAt: ago(1 * DAY) },
      { id: 'm1', expiresAt: ago(30 * DAY) },
      { id: 'm2', expiresAt: ago(10 * DAY) },
    ];
    expect(plan({ messages }).deleteMessages).toEqual(['m1', 'm2', 'm3']);
    expect(plan({ messages, limit: 2 }).deleteMessages).toEqual(['m1', 'm2']);
  });

  it('agrees with messageExpiry: a message made 12 months and a moment ago is due', () => {
    const made = addUtcMonths(NOW, -12);
    expect(
      plan({ messages: [{ id: 'm', expiresAt: messageExpiry(made) }] })
        .deleteMessages
    ).toEqual(['m']);
    const later = new Date(made.getTime() + 1);
    expect(
      plan({ messages: [{ id: 'm', expiresAt: messageExpiry(later) }] })
        .deleteMessages
    ).toEqual([]);
  });
});

describe('planRetention: its arguments', () => {
  it('refuses a clock that is not a date and a limit below one', () => {
    expect(() =>
      planRetention({ now: new Date(NaN), traces: [], messages: [] })
    ).toThrow(RangeError);
    expect(() => plan({ limit: 0 })).toThrow(RangeError);
    expect(() => plan({ limit: -3 })).toThrow(RangeError);
    expect(() => plan({ limit: Number.NaN })).toThrow(RangeError);
  });

  it('does not change its input', () => {
    const traces = [
      { requestId: 'b', createdAt: ago(100 * DAY), archivedAt: null },
      { requestId: 'a', createdAt: ago(200 * DAY), archivedAt: null },
    ];
    const messages = [{ id: 'm', expiresAt: ago(DAY) }];
    const before = JSON.stringify({ traces, messages });
    plan({ traces, messages });
    expect(JSON.stringify({ traces, messages })).toBe(before);
    expect(traces.map((t) => t.requestId)).toEqual(['b', 'a']);
  });

  it('is the same twice', () => {
    const traces = [
      { requestId: 'a', createdAt: ago(100 * DAY), archivedAt: null },
    ];
    expect(plan({ traces })).toEqual(plan({ traces }));
  });
});

describe('planRetention: the edges of what it can judge', () => {
  it('a trace made exactly now is not in the future, and is kept', () => {
    const result = plan({
      traces: [{ requestId: 't', createdAt: NOW, archivedAt: null }],
    });
    expect(result.problems).toEqual([]);
    expect(result.traceKept).toBe(1);
  });

  it('a trace archived the moment it was made, or exactly now, is a normal archived row', () => {
    const made = ago(200 * DAY);
    const result = plan({
      traces: [
        { requestId: 'same-moment', createdAt: made, archivedAt: made },
        { requestId: 'now', createdAt: made, archivedAt: NOW },
      ],
    });
    expect(result.problems).toEqual([]);
    expect(result.deleteLive).toEqual(['now', 'same-moment']);
  });

  it('puts rows made at the same moment in id order, whatever order they came in', () => {
    const ids = ['a', 'b', 'c'];
    const orders = [
      ['a', 'b', 'c'],
      ['a', 'c', 'b'],
      ['b', 'a', 'c'],
      ['b', 'c', 'a'],
      ['c', 'a', 'b'],
      ['c', 'b', 'a'],
    ];
    for (const order of orders) {
      const result = plan({
        traces: order.map((requestId) => ({
          requestId,
          createdAt: ago(100 * DAY),
          archivedAt: null,
        })),
        messages: order.map((id) => ({ id, expiresAt: ago(DAY) })),
      });
      expect(result.archive.map((a) => a.requestId)).toEqual(ids);
      expect(result.deleteMessages).toEqual(ids);
      const archived = plan({
        traces: order.map((requestId) => ({
          requestId,
          createdAt: ago(100 * DAY),
          archivedAt: ago(DAY),
        })),
      });
      expect(archived.deleteLive).toEqual(ids);
    }
  });

  it('says what it refuses', () => {
    expect(() =>
      planRetention({ now: new Date(NaN), traces: [], messages: [] })
    ).toThrow('now is not a valid date');
    expect(() => plan({ limit: 0 })).toThrow('limit is at least 1');
  });
});

describe('planRetention: a long list', () => {
  it('puts a few hundred rows made at the same moment in id order, however they come', () => {
    // past the length at which the sort stops being a plain insertion: the comparator has to be right
    const ids = Array.from(
      { length: 300 },
      (_, i) => `req-${String(i).padStart(4, '0')}`
    );
    let seed = 12345;
    const shuffled = [...ids];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      const j = seed % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    expect(shuffled).not.toEqual(ids);
    const result = plan({
      traces: shuffled.map((requestId) => ({
        requestId,
        createdAt: ago(100 * DAY),
        archivedAt: null,
      })),
      messages: shuffled.map((id) => ({ id, expiresAt: ago(DAY) })),
    });
    expect(result.archive.map((a) => a.requestId)).toEqual(ids);
    expect(result.deleteMessages).toEqual(ids);
    expect(
      plan({
        traces: [],
        messages: [{ id: 'only', expiresAt: ago(DAY) }],
        limit: 5,
      }).deleteMessages
    ).toEqual(['only']);
  });
});
