/**
 * @jest-environment node
 */

/**
 * The migration `20261014000000_add_reply_trace_and_chat_tables` against the Prisma schema,
 * the TypeScript contracts and the architecture's rules (build step 7, part 1). Prisma cannot
 * see a CHECK constraint or a trigger, so its drift check says nothing when a model gains a
 * column without the migration's rules, or when a bound is edited in one place only: this
 * test is what notices. The gated spec `__tests__/reply/reply-trace-chat.pg.spec.ts` shows
 * what a real PostgreSQL does with the same file.
 */

import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

import {
  BIASES,
  DATA_STATUSES,
  INSTANT_INTENTS,
  LOCALES,
  PACKET_INTENTS,
  SLOT_SECONDS,
  TRADER_TYPES,
} from '@/lib/intake';
import {
  MESSAGE_ROLES,
  MESSAGE_TEXT_MAX,
} from '@/lib/platform/chat/messages-store';
import {
  THREAD_SYMBOL,
  TITLE_SOURCES,
} from '@/lib/platform/chat/threads-store';
import { PREVIEW_MAX_CHARS, TITLE_MAX_CHARS } from '@/lib/platform/chat/title';
import { ID, MODEL_SLUG } from '@/lib/reply/contracts/fields';
import { RESULT_KINDS } from '@/lib/reply/contracts/result';
import {
  CONSENT_ACTIONS,
  REPLY_OUTCOMES,
  TRACE_TIERS,
} from '@/lib/reply/contracts/trace-fields';

import { makeTrace, riskGroup } from '../reply/helpers/fixtures';

const ROOT = resolve(__dirname, '..', '..', '..');
const MIGRATION_NAME = '20261014000000_add_reply_trace_and_chat_tables';

const read = (path: string): string =>
  readFileSync(resolve(ROOT, path), 'utf8').replace(/\r\n/g, '\n');

const SQL = read(`prisma/migrations/${MIGRATION_NAME}/migration.sql`);
const SCHEMA = read('prisma/non-market-data/schema.prisma');

const TABLES = {
  RequestTrace: 'request_traces',
  ChatThread: 'chat_threads',
  ChatMessage: 'chat_messages',
} as const;

// ---------------------------------------------------------------------------
// Reading the two files
// ---------------------------------------------------------------------------

interface Column {
  type: string;
  notNull: boolean;
}

function sqlColumns(table: string): Map<string, Column> {
  const match = new RegExp(
    `CREATE TABLE "${table}" \\(\\n([\\s\\S]*?)\\n\\);`
  ).exec(SQL);
  if (match === null) throw new Error(`no CREATE TABLE for ${table}`);
  const columns = new Map<string, Column>();
  for (const line of match[1]!.split('\n')) {
    const column =
      /^\s+"([a-z0-9_]+)" ([A-Z0-9()]+)( NOT NULL)?( DEFAULT .+?)?,?$/.exec(
        line
      );
    if (column !== null) {
      columns.set(column[1]!, {
        type: column[2]!,
        notNull: column[3] !== undefined,
      });
    }
  }
  return columns;
}

const PRISMA_TO_SQL: Record<string, string> = {
  String: 'TEXT',
  Int: 'INTEGER',
  DateTime: 'TIMESTAMP(3)',
  Json: 'JSONB',
};

function modelBlock(model: string): string {
  const match = new RegExp(`\\nmodel ${model} \\{\\n([\\s\\S]*?)\\n\\}`).exec(
    SCHEMA
  );
  if (match === null) throw new Error(`no model ${model}`);
  return match[1]!;
}

function modelColumns(model: string): Map<string, Column> {
  const columns = new Map<string, Column>();
  for (const line of modelBlock(model).split('\n')) {
    const field =
      /^\s+([a-z0-9_]+)\s+(String|Int|DateTime|Json)(\?)?(\s|$)/.exec(line);
    if (field !== null) {
      columns.set(field[1]!, {
        type: PRISMA_TO_SQL[field[2]!]!,
        notNull: field[3] === undefined,
      });
    }
  }
  return columns;
}

function checkConstraints(): Map<string, { table: string; body: string }> {
  const found = new Map<string, { table: string; body: string }>();
  const pattern =
    /ALTER TABLE "([a-z0-9_]+)" ADD CONSTRAINT "([a-z0-9_]+)" CHECK \(([\s\S]*?)\);\n/g;
  for (const match of SQL.matchAll(pattern)) {
    found.set(match[2]!, {
      table: match[1]!,
      body: match[3]!.replace(/\s+/g, ' ').trim(),
    });
  }
  return found;
}

const CHECKS = checkConstraints();
const body = (name: string): string => {
  const found = CHECKS.get(name);
  if (found === undefined) throw new Error(`no CHECK ${name}`);
  return found.body;
};
/** The words in single quotes of a list `IN ('A', 'B')`. */
const quoted = (text: string): string[] =>
  [...text.matchAll(/'([^']*)'/g)].map((m) => m[1]!);

// ---------------------------------------------------------------------------

describe('the migration and the Prisma models agree on every column', () => {
  test.each(Object.entries(TABLES))('%s -> %s', (model, table) => {
    const fromSql = sqlColumns(table);
    const fromModel = modelColumns(model);
    expect(fromSql.size).toBeGreaterThan(10);
    expect([...fromSql.keys()]).toEqual([...fromModel.keys()]);
    for (const [name, column] of fromModel) {
      expect({ name, ...fromSql.get(name)! }).toEqual({ name, ...column });
    }
  });

  test.each(Object.entries(TABLES))('%s is mapped to %s', (model, table) => {
    expect(modelBlock(model)).toContain(`@@map("${table}")`);
  });

  test('the user id of a trace can be NULL, and its hash and key version cannot', () => {
    const columns = sqlColumns('request_traces');
    expect(columns.get('user_id')?.notNull).toBe(false);
    expect(columns.get('user_id_hash')?.notNull).toBe(true);
    expect(columns.get('key_version')?.notNull).toBe(true);
  });

  test('the seven groups are JSONB, and the risk group alone can be NULL', () => {
    const columns = sqlColumns('request_traces');
    for (const group of [
      'request',
      'data',
      'knowledge',
      'model',
      'checks',
      'time',
    ]) {
      expect(columns.get(`${group}_group`)).toEqual({
        type: 'JSONB',
        notNull: true,
      });
    }
    expect(columns.get('risk_group')).toEqual({
      type: 'JSONB',
      notNull: false,
    });
  });

  test('a trace has no column that could hold the question', () => {
    const names = [...sqlColumns('request_traces').keys()];
    expect(
      names.filter((n) => /question|prompt|text|query|english|original/.test(n))
    ).toEqual([]);
  });
});

describe('types/prisma-stubs.d.ts', () => {
  const STUBS = read('types/prisma-stubs.d.ts');

  test.each(Object.keys(TABLES))(
    '%s has the model’s columns and a delegate',
    (model) => {
      const block = new RegExp(
        `export interface ${model} \\{\\n([\\s\\S]*?)\\n  \\}`
      ).exec(STUBS);
      expect(block).not.toBeNull();
      const fields = [...block![1]!.matchAll(/^\s+([a-z0-9_]+): /gm)].map(
        (m) => m[1]
      );
      expect(fields).toEqual([...modelColumns(model).keys()]);
      const delegate = model.charAt(0).toLowerCase() + model.slice(1);
      expect(STUBS).toContain(`${delegate}: ModelDelegate<${model}>;`);
    }
  );
});

describe('the indexes', () => {
  /** `table:unique?:col,col desc` for each index of the migration */
  function sqlIndexes(): string[] {
    return [
      ...SQL.matchAll(
        /CREATE (UNIQUE )?INDEX "[a-z0-9_]+" ON "([a-z0-9_]+)"\(([^)]*)\);/g
      ),
    ]
      .map((m) => {
        const columns = m[3]!
          .split(',')
          .map((c) =>
            c
              .trim()
              .replace(/"/g, '')
              .replace(/ DESC$/, ':desc')
          )
          .join(',');
        return `${m[2]}:${m[1] === undefined ? 'index' : 'unique'}:${columns}`;
      })
      .sort();
  }

  function modelIndexes(): string[] {
    const out: string[] = [];
    for (const [model, table] of Object.entries(TABLES)) {
      for (const line of modelBlock(model).split('\n')) {
        const attribute = /^\s+@@(index|unique)\(\[([^\]]*)\]/.exec(line);
        if (attribute === null) continue;
        const columns = attribute[2]!
          .split(',')
          .map((c) => c.trim().replace(/\(sort: Desc\)/, ':desc'))
          .join(',');
        out.push(`${table}:${attribute[1]}:${columns}`);
      }
    }
    return out.sort();
  }

  test('the schema and the file have the same indexes', () => {
    expect(sqlIndexes()).toEqual(modelIndexes());
    expect(sqlIndexes().length).toBe(11);
  });

  test('a client request id is unique per user hash, a message number per thread, a request per role', () => {
    expect(sqlIndexes()).toEqual(
      expect.arrayContaining([
        'request_traces:unique:user_id_hash,client_request_id',
        'chat_messages:unique:thread_id,seq',
        'chat_messages:unique:request_id,role',
      ])
    );
  });
});

describe('the CHECK constraints', () => {
  const REQUEST_TRACE_RULES = [
    'ids_are_ids',
    'user_id_hash_is_hex',
    'key_version_is_positive',
    'tier_is_known',
    'locale_is_a_locale',
    'intent_is_known',
    'cycle_slot_is_a_slot',
    'data_status_is_known',
    'model_is_a_slug',
    'units_are_not_negative',
    'regenerations_are_zero_or_one',
    'violations_are_not_negative',
    'outcome_is_known',
    'total_ms_is_not_negative',
    'groups_are_objects',
    'ids_follow_the_request',
    'tier_follows_the_request',
    'locale_follows_the_request',
    'intent_follows_the_request',
    'cycle_slot_follows_the_data',
    'data_status_follows_the_data',
    'model_follows_the_model_group',
    'units_follow_the_model_group',
    'regenerations_follow_the_checks',
    'violations_follow_the_checks',
    'total_ms_follows_the_time',
    'reply_is_its_text_and_hash',
    'report2_is_its_text_and_hash',
    'reply_follows_the_outcome',
    'consent_action_is_known',
    'consent_follows_the_risk_group',
    'report2_is_the_risk_setup',
    'archive_is_complete',
    'groups_hold_no_user_id',
  ];
  const THREAD_RULES = [
    'symbol_is_a_symbol',
    'title_is_short',
    'title_source_is_known',
    'trader_type_is_known',
    'last_bias_is_known',
    'last_cycle_slot_is_a_slot',
    'preview_is_short',
    'counts_are_consistent',
  ];
  const MESSAGE_RULES = [
    'seq_is_positive',
    'request_id_is_an_id',
    'role_and_kind_agree',
    'content_fits_the_kind',
    'text_is_bounded',
    'json_is_an_object',
    'intent_is_known',
    'cycle_slot_is_a_slot',
    'expires_after_it_began',
  ];

  const expected = [
    ...REQUEST_TRACE_RULES.map((r) => `request_traces_${r}`),
    ...THREAD_RULES.map((r) => `chat_threads_${r}`),
    ...MESSAGE_RULES.map((r) => `chat_messages_${r}`),
  ];

  test('are exactly these, each on the table its name starts with', () => {
    expect([...CHECKS.keys()].sort()).toEqual([...expected].sort());
    for (const [name, { table }] of CHECKS) {
      expect(name.startsWith(`${table}_`)).toBe(true);
    }
    expect(CHECKS.size).toBe(51);
  });

  test('every constraint, index, trigger and function name fits PostgreSQL’s 63 bytes', () => {
    const names = [
      ...SQL.matchAll(/(?:CONSTRAINT|INDEX|TRIGGER|FUNCTION) "([^"]+)"/g),
    ].map((m) => m[1]!);
    expect(names.length).toBeGreaterThan(50);
    for (const name of names)
      expect(Buffer.byteLength(name, 'utf8')).toBeLessThanOrEqual(63);
  });

  test('a rule that compares with a group uses IS NOT DISTINCT FROM, because a CHECK passes on NULL', () => {
    for (const [name, check] of CHECKS) {
      // (the reply rule compares two booleans, not a column with a group)
      if (
        /_follow(s)?_the_/.test(name) &&
        name !== 'request_traces_reply_follows_the_outcome'
      ) {
        expect({
          name,
          distinct: /IS NOT DISTINCT FROM/.test(check.body),
        }).toEqual({ name, distinct: true });
        // a bare `column = (group->>'key')` would pass when the key is missing
        expect({
          name,
          bare: /"[a-z_]+"(::text)? = \(/.test(check.body),
        }).toEqual({ name, bare: false });
      }
    }
  });

  describe('request_traces: the lists are the contracts’', () => {
    test('tier, intent, data status, outcome and consent action', () => {
      expect(quoted(body('request_traces_tier_is_known'))).toEqual([
        ...TRACE_TIERS,
      ]);
      expect(quoted(body('request_traces_intent_is_known'))).toEqual([
        ...PACKET_INTENTS,
      ]);
      expect(quoted(body('request_traces_data_status_is_known'))).toEqual([
        ...DATA_STATUSES,
      ]);
      expect(quoted(body('request_traces_outcome_is_known'))).toEqual([
        ...REPLY_OUTCOMES,
      ]);
      expect(quoted(body('request_traces_consent_action_is_known'))).toEqual([
        ...CONSENT_ACTIONS,
      ]);
    });

    test('the locale pattern accepts the 19 locales and nothing like another', () => {
      const pattern = new RegExp(
        /"locale" ~ '([^']*)'/.exec(
          body('request_traces_locale_is_a_locale')
        )![1]!
      );
      for (const locale of LOCALES) expect(pattern.test(locale)).toBe(true);
      for (const other of ['EN-us', 'pt_BR', 'xxx', 'en-', '', 'en-US ']) {
        expect(pattern.test(other)).toBe(false);
      }
    });

    test('the id pattern is the contracts’ ID, and the model pattern their slug', () => {
      expect(body('request_traces_ids_are_ids')).toContain(`~ '${ID.source}'`);
      expect(body('request_traces_model_is_a_slug')).toContain(
        `~ '${MODEL_SLUG.source}'`
      );
    });

    test('the hash is 64 lowercase hex characters, as the Engine 4 audit tables have it', () => {
      expect(body('request_traces_user_id_hash_is_hex')).toBe(
        `"user_id_hash" ~ '^[0-9a-f]{64}$'`
      );
    });

    test('a cycle slot is a multiple of the slot length, in every table that has one', () => {
      for (const name of [
        'request_traces_cycle_slot_is_a_slot',
        'chat_threads_last_cycle_slot_is_a_slot',
        'chat_messages_cycle_slot_is_a_slot',
      ]) {
        expect(body(name)).toContain(`% ${SLOT_SECONDS} = 0`);
      }
      expect(SLOT_SECONDS).toBe(300);
    });

    test('there is at most one regeneration', () => {
      expect(body('request_traces_regenerations_are_zero_or_one')).toBe(
        '"regenerations" BETWEEN 0 AND 1'
      );
    });

    test('Report 2 is the setup the risk group names, and a consent action is the group’s own', () => {
      expect(body('request_traces_report2_is_the_risk_setup')).toBe(
        `"report2_sha256" IS NULL OR ("risk_group"->>'setup_sha256') IS NOT DISTINCT FROM "report2_sha256"`
      );
      expect(body('request_traces_consent_follows_the_risk_group')).toBe(
        `"consent_action" IS NOT DISTINCT FROM ("risk_group"->>'consent_action')`
      );
    });

    test('every outcome but ERROR has a reply', () => {
      expect(body('request_traces_reply_follows_the_outcome')).toBe(
        `("outcome" = 'ERROR') = ("reply_json" IS NULL)`
      );
      expect(REPLY_OUTCOMES).toContain('ERROR');
    });
  });

  describe('request_traces: a column is projected from a group, and the group has that key', () => {
    const groups: Record<string, unknown> = {
      request_group: makeTrace().request,
      data_group: makeTrace().data,
      knowledge_group: makeTrace().knowledge,
      model_group: makeTrace().model,
      checks_group: makeTrace().checks,
      risk_group: riskGroup(),
      time_group: makeTrace().time,
    };

    /** Every `group->'a'->>'b'` path in the file, resolved against a real trace. */
    const references = [
      ...SQL.matchAll(
        /"([a-z]+_group)"((?:->'[a-z_0-9]+')*)->>'([a-z_0-9]+)'/g
      ),
    ].map((m) => ({
      group: m[1]!,
      path: [...m[2]!.matchAll(/->'([a-z_0-9]+)'/g)].map((p) => p[1]!),
      key: m[3]!,
    }));

    test('there are the projections the architecture lists', () => {
      expect(
        references
          .map((r) => `${r.group}.${[...r.path, r.key].join('.')}`)
          .sort()
      ).toEqual(
        [
          'request_group.request_id',
          'request_group.client_request_id',
          'request_group.thread_id',
          'request_group.tier',
          'request_group.reply_locale',
          'request_group.intent',
          'data_group.cycle_slot',
          'data_group.data_status',
          'model_group.model',
          'model_group.units_charged',
          'checks_group.regenerations',
          'checks_group.numbers.violations',
          'checks_group.wording.violations',
          'time_group.total_ms',
          'risk_group.consent_action',
          'risk_group.setup_sha256',
        ].sort()
      );
    });

    test.each(
      references.map(
        (r) => [`${r.group}.${[...r.path, r.key].join('.')}`, r] as const
      )
    )('%s exists in the contract’s object', (_name, ref) => {
      let node: any = groups[ref.group];
      for (const step of [...ref.path, ref.key]) {
        expect(node).toBeDefined();
        node = node[step];
      }
      expect(node).toBeDefined();
    });

    test('the no-user-id rule lists all seven groups and both reports', () => {
      const text = body('request_traces_groups_hold_no_user_id');
      for (const group of Object.keys(groups))
        expect(text).toContain(`"${group}"::text`);
      expect(text).toContain('"reply_json"');
      expect(text).toContain('"report2_json"');
      expect(text).toMatch(/^"user_id" IS NULL OR strpos\(/);
    });
  });

  describe('chat tables: the lists are the stores’', () => {
    test('title source, trader type, bias, symbol, role', () => {
      expect(quoted(body('chat_threads_title_source_is_known'))).toEqual([
        ...TITLE_SOURCES,
      ]);
      expect(quoted(body('chat_threads_trader_type_is_known')).sort()).toEqual(
        [...TRADER_TYPES].sort()
      );
      expect(quoted(body('chat_threads_last_bias_is_known'))).toEqual([
        ...BIASES,
      ]);
      expect(body('chat_threads_symbol_is_a_symbol')).toBe(
        `"symbol" ~ '${THREAD_SYMBOL.source}'`
      );
      expect(
        quoted(body('chat_messages_role_and_kind_agree')).slice(0, 1)
      ).toEqual([MESSAGE_ROLES[0]]);
    });

    test('a message kind is a TYPED or INSTANT question or one of the kinds a result can be, or a refusal', () => {
      expect(quoted(body('chat_messages_role_and_kind_agree'))).toEqual([
        'USER',
        'TYPED',
        'INSTANT',
        'ASSISTANT',
        ...RESULT_KINDS,
        'REFUSAL',
      ]);
    });

    test('an instant message has an instant intent, and only an instant message', () => {
      const text = body('chat_messages_content_fits_the_kind');
      expect(text).toContain(
        `"intent" IS NOT NULL AND "intent" IN (${INSTANT_INTENTS.map((i) => `'${i}'`).join(', ')})`
      );
      expect(quoted(body('chat_messages_intent_is_known'))).toEqual([
        ...PACKET_INTENTS,
      ]);
    });

    test('the limits are the stores’: a title of 80, a preview of 120, a text of 2,000', () => {
      expect(body('chat_threads_title_is_short')).toContain(
        `BETWEEN 1 AND ${TITLE_MAX_CHARS}`
      );
      expect(body('chat_threads_preview_is_short')).toBe(
        `char_length("last_preview") <= ${PREVIEW_MAX_CHARS}`
      );
      expect(body('chat_messages_text_is_bounded')).toContain(
        `BETWEEN 1 AND ${MESSAGE_TEXT_MAX}`
      );
    });

    test('a report is one of the messages: the report count never exceeds the message count', () => {
      expect(body('chat_threads_counts_are_consistent')).toContain(
        '"report_count" <= "message_count"'
      );
    });
  });
});

describe('the foreign keys', () => {
  const foreignKeys = new Map<
    string,
    { table: string; column: string; references: string; onDelete: string }
  >();
  for (const match of SQL.matchAll(
    /ALTER TABLE "([a-z0-9_]+)" ADD CONSTRAINT "([a-z0-9_]+)" FOREIGN KEY \("([a-z0-9_]+)"\) REFERENCES "([A-Za-z0-9_]+)"\("id"\) ON DELETE ([A-Z ]+?) ON UPDATE/g
  )) {
    foreignKeys.set(match[2]!, {
      table: match[1]!,
      column: match[3]!,
      references: match[4]!,
      onDelete: match[5]!,
    });
  }

  test('are these three, with these delete rules', () => {
    expect(
      Object.fromEntries(
        [...foreignKeys].map(([k, v]) => [k, [v.references, v.onDelete]])
      )
    ).toEqual({
      request_traces_user_id_fkey: ['User', 'SET NULL'],
      chat_threads_user_id_fkey: ['User', 'CASCADE'],
      chat_messages_thread_id_fkey: ['chat_threads', 'CASCADE'],
    });
  });

  test('the trace has no foreign key to a thread: deleting a thread leaves the audit row', () => {
    expect(
      [...foreignKeys.values()]
        .filter((fk) => fk.table === 'request_traces')
        .map((fk) => fk.column)
    ).toEqual(['user_id']);
  });

  test('the Prisma relations say the same', () => {
    const rules = (model: string): string[] =>
      [...modelBlock(model).matchAll(/@relation\([^)]*onDelete: (\w+)\)/g)].map(
        (m) => m[1]!
      );
    expect(rules('RequestTrace')).toEqual(['SetNull']);
    expect(rules('ChatThread')).toEqual(['Cascade']);
    expect(rules('ChatMessage')).toEqual(['Cascade']);
  });

  test('the User model names the relations', () => {
    expect(SCHEMA).toMatch(/\n  chatThreads\s+ChatThread\[\]\n/);
    expect(SCHEMA).toMatch(/\n  requestTraces\s+RequestTrace\[\]\n/);
  });
});

describe('the guard on request_traces', () => {
  const fn = /CREATE FUNCTION "request_traces_guard"\(\)[\s\S]*?\$\$;/.exec(
    SQL
  )![0];

  test('refuses with restrict_violation, and a DELETE only when the row is archived', () => {
    expect(fn).toContain(`ERRCODE = 'restrict_violation'`);
    expect(fn).toMatch(
      /IF TG_OP = 'DELETE' THEN\s+IF OLD\."archived_at" IS NOT NULL THEN\s+RETURN OLD;/
    );
  });

  test('lets an unarchived row change exactly these columns, an archived one only the user id', () => {
    const unarchived =
      /IF OLD\."archived_at" IS NULL THEN\s+allowed := ARRAY\[([^\]]*)\];/.exec(
        fn
      )![1]!;
    expect(quoted(unarchived)).toEqual([
      'user_id',
      'risk_group',
      'report2_json',
      'report2_sha256',
      'consent_action',
      'archived_at',
      'archive_ref',
    ]);
    const archived = /ELSE\s+allowed := ARRAY\[([^\]]*)\];/.exec(fn)![1]!;
    expect(quoted(archived)).toEqual(['user_id']);
  });

  test('the columns the risk attachment writes are among the ones it lets change', () => {
    const allowed = quoted(
      /IF OLD\."archived_at" IS NULL THEN\s+allowed := ARRAY\[([^\]]*)\];/.exec(
        fn
      )![1]!
    );
    for (const column of [
      'risk_group',
      'report2_json',
      'report2_sha256',
      'consent_action',
    ]) {
      expect(allowed).toContain(column);
    }
    // and every sealed column is a real column of the table
    const columns = [...sqlColumns('request_traces').keys()];
    for (const column of allowed) expect(columns).toContain(column);
    expect(columns.filter((c) => !allowed.includes(c))).toEqual(
      expect.arrayContaining([
        'request_id',
        'client_request_id',
        'user_id_hash',
        'key_version',
        'request_group',
        'data_group',
        'knowledge_group',
        'model_group',
        'checks_group',
        'time_group',
        'reply_json',
        'reply_sha256',
        'created_at',
        'outcome',
      ])
    );
  });

  test('lets the user id go from a value to NULL (what ON DELETE SET NULL does) and never back', () => {
    expect(fn).toContain('NEW."user_id" IS NOT DISTINCT FROM OLD."user_id"');
    expect(fn).toContain('OLD."user_id" IS NOT NULL AND NEW."user_id" IS NULL');
  });

  test('refuses anything else, TRUNCATE included, and OLD and NEW are only touched for DELETE and UPDATE', () => {
    expect(fn).toMatch(/RAISE EXCEPTION 'request_traces: % is refused', TG_OP/);
    expect(fn.indexOf(`TG_OP = 'DELETE'`)).toBeLessThan(
      fn.indexOf('OLD."archived_at"')
    );
    expect(fn.indexOf(`TG_OP = 'UPDATE'`)).toBeLessThan(
      fn.indexOf('NEW."user_id"')
    );
  });

  test('has a row trigger for UPDATE and DELETE and a statement trigger for TRUNCATE, on request_traces only', () => {
    const triggers = [
      ...SQL.matchAll(
        /CREATE TRIGGER "([a-z0-9_]+)"\n\s+(BEFORE [A-Z ]+) ON "([a-z0-9_]+)"\n\s+(FOR EACH [A-Z]+) EXECUTE FUNCTION "request_traces_guard"\(\);/g
      ),
    ].map((m) => [m[3], m[2], m[4], m[1]]);
    expect(triggers).toEqual([
      [
        'request_traces',
        'BEFORE UPDATE OR DELETE',
        'FOR EACH ROW',
        'request_traces_guard_rows',
      ],
      [
        'request_traces',
        'BEFORE TRUNCATE',
        'FOR EACH STATEMENT',
        'request_traces_guard_truncate',
      ],
    ]);
    expect(SQL.match(/CREATE TRIGGER/g)).toHaveLength(2);
  });
});

describe('the migration file', () => {
  test('sorts after every earlier migration and is the newest', () => {
    const names = readdirSync(resolve(ROOT, 'prisma', 'migrations')).filter(
      (name) => /^\d{14}_/.test(name)
    );
    expect(names).toContain(MIGRATION_NAME);
    expect(MIGRATION_NAME > '20261010000000_add_engine4_tables').toBe(true);
    expect(names.sort().pop()).toBe(MIGRATION_NAME);
  });

  test('is additive: it creates and constrains, and drops or alters nothing that exists', () => {
    const statements = SQL.split('\n')
      .filter((line) => !line.startsWith('--'))
      .join('\n');
    expect(statements).not.toMatch(/\bDROP\b/);
    expect(statements).not.toMatch(
      /\bTRUNCATE TABLE\b|\bDELETE FROM\b|\bINSERT INTO\b|\bUPDATE "/
    );
    for (const match of statements.matchAll(/ALTER TABLE "([A-Za-z0-9_]+)"/g)) {
      expect(Object.values(TABLES)).toContain(match[1]);
    }
  });

  test('says in its header that it is not applied, the rollout order, how to roll it back and what the guard does', () => {
    expect(SQL).toMatch(/NOT APPLIED/);
    expect(SQL).toMatch(/ROLLOUT ORDER/);
    expect(SQL).toMatch(/ROLLBACK/);
    expect(SQL).toMatch(
      /migrate resolve --applied 20261014000000_add_reply_trace_and_chat_tables/
    );
    expect(SQL).toMatch(
      /migrate resolve --rolled-back 20261014000000_add_reply_trace_and_chat_tables/
    );
    expect(SQL).toMatch(/ENGINE4_AUDIT_HMAC_KEY/);
    expect(SQL).toMatch(/WHAT THE TRIGGER ON request_traces DOES/);
    expect(SQL).toMatch(/WHAT DELETING A User DOES/);
  });

  test('the DDL part is the Prisma diff and the rest comes after the last foreign key', () => {
    const lastForeignKey = SQL.lastIndexOf('-- AddForeignKey');
    const firstCheck = SQL.indexOf(
      'ADD CONSTRAINT "request_traces_ids_are_ids"'
    );
    expect(lastForeignKey).toBeGreaterThan(0);
    expect(firstCheck).toBeGreaterThan(lastForeignKey);
  });
});
