/**
 * In-memory stand-ins for the database client of the platform stores. They model only what
 * the stores rely on and what a unit test must be able to see: the keys that are unique, the
 * `where` that includes the user id, the interactive transaction that rolls back whole, and
 * the cascade of a thread's messages. What the real database does is shown by the gated spec
 * `__tests__/reply/reply-trace-chat.pg.spec.ts`.
 */

import type {
  MessageCreateData,
  MessageRow,
  MessageStoreClient,
  MessageTx,
} from '@/lib/platform/chat/messages-store';
import type {
  ThreadCreateData,
  ThreadListWhere,
  ThreadRow,
  ThreadStoreClient,
} from '@/lib/platform/chat/threads-store';
import type {
  RiskUpdateData,
  StoredTrace,
  TraceCreateData,
  TraceStoreClient,
} from '@/lib/platform/traces/store';

export class UniqueViolation extends Error {
  readonly code = 'P2002';
  constructor(what: string) {
    super(`Unique constraint failed on ${what}`);
  }
}

/** Prisma's error for `update` on a row that is not there. */
export class RecordNotFound extends Error {
  readonly code = 'P2025';
  constructor() {
    super(
      'An operation failed because it depends on a record that was not found.'
    );
  }
}

// ---------------------------------------------------------------------------
// request_traces
// ---------------------------------------------------------------------------

export interface TraceCalls {
  create: TraceCreateData[];
  updateMany: {
    where: { request_id: string; user_id: string };
    data: RiskUpdateData;
  }[];
  findUnique: string[];
}

export class FakeTraceClient implements TraceStoreClient {
  readonly rows = new Map<string, StoredTrace>();
  readonly calls: TraceCalls = { create: [], updateMany: [], findUnique: [] };

  readonly requestTrace: TraceStoreClient['requestTrace'] = {
    create: async ({ data }) => {
      this.calls.create.push(structuredClone(data));
      if (this.rows.has(data.request_id))
        throw new UniqueViolation('request_id');
      for (const row of this.rows.values()) {
        if (
          row.user_id_hash === data.user_id_hash &&
          row.client_request_id === data.client_request_id
        ) {
          throw new UniqueViolation('user_id_hash, client_request_id');
        }
      }
      this.rows.set(data.request_id, {
        report2_json: null,
        report2_sha256: null,
        risk_group: null,
        ...structuredClone(data),
        created_at: new Date(),
        archived_at: null,
        archive_ref: null,
      } as StoredTrace);
      return { request_id: data.request_id };
    },
    updateMany: async ({ where, data }) => {
      this.calls.updateMany.push(structuredClone({ where, data }));
      const row = this.rows.get(where.request_id);
      if (row === undefined || row.user_id !== where.user_id)
        return { count: 0 };
      Object.assign(row, structuredClone(data));
      return { count: 1 };
    },
    findUnique: async ({ where }) => {
      this.calls.findUnique.push(where.request_id);
      const row = this.rows.get(where.request_id);
      return row === undefined ? null : structuredClone(row);
    },
  };
}

// ---------------------------------------------------------------------------
// chat_threads and chat_messages
// ---------------------------------------------------------------------------

export class FakeChatClient {
  /** the stores take it as their client: `fake.client()` */
  client(): ThreadStoreClient & MessageStoreClient {
    return this as unknown as ThreadStoreClient & MessageStoreClient;
  }

  threads = new Map<string, ThreadRow>();
  messages: MessageRow[] = [];
  /** every delegate call, in order, as `delegate.method` */
  readonly log: string[] = [];
  private counter = 0;
  /** the clock for `last_message_at` defaults and ids */
  now = new Date(Date.UTC(2026, 8, 18, 21, 0, 0));

  private id(prefix: string): string {
    this.counter += 1;
    return `${prefix}${String(this.counter).padStart(12, '0')}`;
  }

  /** Put a thread in the table as the database would hold it. */
  seedThread(over: Partial<ThreadRow> & { user_id: string }): ThreadRow {
    const row: ThreadRow = {
      id: this.id('cm0thread'),
      symbol: 'XAUUSD',
      title: 'XAUUSD · LONG · 18 SEP 20:55',
      title_source: 'AUTO',
      trader_type: 'DAY_TRADER',
      last_bias: null,
      last_cycle_slot: null,
      last_preview: '',
      message_count: 0,
      report_count: 0,
      last_message_at: this.now,
      created_at: this.now,
      updated_at: this.now,
      ...over,
    };
    this.threads.set(row.id, row);
    return row;
  }

  /** Write `data` into a row the way Prisma reads it: `{ increment: n }` adds, anything else sets. */
  private apply(row: ThreadRow, data: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(data)) {
      const target = row as unknown as Record<string, unknown>;
      if (typeof value === 'object' && value !== null && 'increment' in value) {
        target[key] =
          (target[key] as number) + (value as { increment: number }).increment;
      } else {
        target[key] = value;
      }
    }
  }

  private snapshot() {
    return {
      threads: new Map([...this.threads].map(([k, v]) => [k, { ...v }])),
      messages: this.messages.map((m) => ({ ...m })),
    };
  }

  readonly chatThread = {
    create: async ({
      data,
    }: {
      data: ThreadCreateData;
    }): Promise<ThreadRow> => {
      this.log.push('chatThread.create');
      const row: ThreadRow = {
        id: this.id('cm0thread'),
        last_bias: null,
        last_cycle_slot: null,
        last_preview: '',
        message_count: 0,
        report_count: 0,
        last_message_at: this.now,
        created_at: this.now,
        updated_at: this.now,
        ...data,
      };
      this.threads.set(row.id, row);
      return { ...row };
    },
    findFirst: async ({
      where,
      select,
    }: {
      where: { id: string; user_id: string };
      select?: Record<string, true>;
    }): Promise<never> => {
      this.log.push('chatThread.findFirst');
      const row = this.threads.get(where.id);
      const mine = row !== undefined && row.user_id === where.user_id;
      if (!mine) return null as never;
      if (select === undefined) return { ...row } as never;
      return Object.fromEntries(
        Object.keys(select).map((k) => [k, (row as never)[k]])
      ) as never;
    },
    findMany: async ({
      where,
      orderBy,
      take,
    }: {
      where: ThreadListWhere;
      orderBy: ({ last_message_at: 'desc' } | { id: 'desc' })[];
      take: number;
    }): Promise<ThreadRow[]> => {
      this.log.push('chatThread.findMany');
      expect(orderBy).toEqual([{ last_message_at: 'desc' }, { id: 'desc' }]);
      const rows = [...this.threads.values()].filter((t) => {
        if (t.user_id !== where.user_id) return false;
        if (where.OR === undefined) return true;
        return where.OR.some((clause) =>
          'id' in clause
            ? t.last_message_at.getTime() ===
                clause.last_message_at.getTime() && t.id < clause.id.lt
            : t.last_message_at.getTime() < clause.last_message_at.lt.getTime()
        );
      });
      rows.sort(
        (a, b) =>
          b.last_message_at.getTime() - a.last_message_at.getTime() ||
          (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
      );
      return rows.slice(0, take).map((r) => ({ ...r }));
    },
    update: async ({
      where,
      data,
      select,
    }: {
      where: { id: string; user_id: string };
      data: Record<string, unknown>;
      select: Record<string, true>;
    }): Promise<never> => {
      this.log.push('chatThread.update');
      const row = this.threads.get(where.id);
      if (row === undefined || row.user_id !== where.user_id)
        throw new RecordNotFound();
      this.apply(row, data);
      return Object.fromEntries(
        Object.keys(select).map((k) => [k, (row as never)[k]])
      ) as never;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { id: string; user_id: string };
      data: Record<string, unknown>;
    }): Promise<{ count: number }> => {
      this.log.push('chatThread.updateMany');
      const row = this.threads.get(where.id);
      if (row === undefined || row.user_id !== where.user_id)
        return { count: 0 };
      this.apply(row, data);
      return { count: 1 };
    },
    deleteMany: async ({
      where,
    }: {
      where: { id: string; user_id: string };
    }): Promise<{ count: number }> => {
      this.log.push('chatThread.deleteMany');
      const row = this.threads.get(where.id);
      if (row === undefined || row.user_id !== where.user_id)
        return { count: 0 };
      this.threads.delete(where.id);
      // the foreign key: a thread's messages go with it
      this.messages = this.messages.filter((m) => m.thread_id !== where.id);
      return { count: 1 };
    },
  };

  readonly chatMessage = {
    create: async ({
      data,
    }: {
      data: MessageCreateData;
    }): Promise<MessageRow> => {
      this.log.push('chatMessage.create');
      for (const m of this.messages) {
        if (m.thread_id === data.thread_id && m.seq === data.seq) {
          throw new UniqueViolation('thread_id, seq');
        }
        if (m.request_id === data.request_id && m.role === data.role) {
          throw new UniqueViolation('request_id, role');
        }
      }
      const row: MessageRow = {
        id: this.id('cm0message'),
        body_json: null,
        ...data,
      } as MessageRow;
      this.messages.push(row);
      return { ...row };
    },
    findMany: async ({
      where,
      take,
    }: {
      where: { thread_id: string; seq?: { gt: number } };
      orderBy: { seq: 'asc' };
      take: number;
    }): Promise<MessageRow[]> => {
      this.log.push('chatMessage.findMany');
      return this.messages
        .filter(
          (m) =>
            m.thread_id === where.thread_id &&
            (where.seq === undefined || m.seq > where.seq.gt)
        )
        .sort((a, b) => a.seq - b.seq)
        .slice(0, take)
        .map((m) => ({ ...m }));
    },
  };

  /** An interactive transaction: if the callback throws, everything it did is undone. */
  $transaction = async <T>(fn: (tx: MessageTx) => Promise<T>): Promise<T> => {
    this.log.push('$transaction');
    const before = this.snapshot();
    try {
      return await fn(this as unknown as MessageTx);
    } catch (error) {
      this.threads = before.threads;
      this.messages = before.messages;
      throw error;
    }
  };
}
