/**
 * The edges of the intake route tests, in one place so every test file wires the same ones
 * (build step 6 part 5). A test file declares its `jest.mock(...)` lines (they must sit in the
 * file to be hoisted) and each factory returns one of the module shapes below; the test imports
 * this file for the handles (`state`, `calls`, `signIn`, `model`, `knowledge`).
 *
 * What runs for real: the route files, the route layer, the gate, the pipeline, the snapshot
 * reader, the events reader, the board, the router, the packet, the adapters of the knowledge
 * service and of the Understand model (over a fake `fetch`), the reply texts and the 19
 * dictionaries. What is replaced: the session, the language cookie, the stored profile, the
 * market database (answering from a stored golden world, like the part 4 tests), the gateway,
 * and the network.
 */

import type { Session } from 'next-auth';

import {
  fakeClient,
  gatewayBody,
  goldenWorlds,
  type GatewayStatus,
  type World,
} from '../../../lib/intake/helpers/world';

export const WORLDS = goldenWorlds();
export const USER_ID = 'user_pro_1';

export const calls = {
  getSession: jest.fn(),
  locale: jest.fn(),
  readProfile: jest.fn(),
  gateway: jest.fn(),
  database: jest.fn(),
};

export interface State {
  world: World;
  gateway: GatewayStatus | 'THROWS';
  locale: string;
  profile: Record<string, string> | null;
}

export const state: State = {
  world: WORLDS[0] as World,
  gateway: 'FRESH',
  locale: 'en-US',
  profile: null,
};

/** The stored profile of a trader, all eight metrics, as the profile store keeps it. */
export const STORED_PROFILE = {
  traderType: 'DAY_TRADER',
  style: 'BOTH',
  maxRiskPct: '1.5',
  maxLeverage: '5',
  targetRrr: '1.75',
  equity: '98765.4321',
  minSld: '13',
  commission: '7.3719',
};

export function signIn(tier: 'FREE' | 'PRO' | undefined, id = USER_ID): void {
  calls.getSession.mockImplementation(async () =>
    tier === undefined
      ? { user: { id } }
      : ({ user: { id, tier } } as unknown as Session)
  );
}

export function signOut(): void {
  calls.getSession.mockImplementation(async () => null);
}

/** Put every handle back to its starting point: nobody signed in, the first golden cycle, English. */
export function resetAll(): void {
  for (const fn of Object.values(calls)) fn.mockReset();
  state.world = WORLDS[0] as World;
  state.gateway = 'FRESH';
  state.locale = 'en-US';
  state.profile = { ...STORED_PROFILE };
  signOut();
  calls.locale.mockImplementation(async () => state.locale);
  calls.readProfile.mockImplementation(async () =>
    state.profile === null ? null : { profile: { ...state.profile } }
  );
  calls.gateway.mockImplementation(async () => {
    if (state.gateway === 'THROWS') {
      throw Object.assign(new Error('the gateway could not be reached'), {
        kind: 'UNREACHABLE',
      });
    }
    return gatewayBody(state.world, { status: state.gateway });
  });
}

// ---- module shapes ----------------------------------------------------------

export function sessionModule(): Record<string, unknown> {
  return { getSession: (...args: unknown[]) => calls.getSession(...args) };
}

export function localeModule(): Record<string, unknown> {
  return { getServerLanguage: (...args: unknown[]) => calls.locale(...args) };
}

export function profileStoreModule(): Record<string, unknown> {
  class StoredProfileError extends Error {}
  return {
    StoredProfileError,
    readProfile: (...args: unknown[]) => calls.readProfile(...args),
  };
}

export function gatewayModule(): Record<string, unknown> {
  return { fetchCurrentCycle: (...args: unknown[]) => calls.gateway(...args) };
}

/** The market database, answering the snapshot reader and the calendar reader from the world in `state`. */
export function marketPrismaModule(): Record<string, unknown> {
  const delegates = (): ReturnType<typeof fakeClient>['client'] => {
    calls.database();
    return fakeClient(state.world).client;
  };
  return {
    marketPrisma: {
      mcdOutput: {
        findMany: (args: never) => delegates().mcdOutput.findMany(args),
      },
      synthesisReading: {
        findFirst: (args: never) =>
          delegates().synthesisReading.findFirst(args),
      },
      entryZone: {
        findMany: (args: never) => delegates().entryZone.findMany(args),
      },
      marketCycle: {
        findFirst: (args: never) => delegates().marketCycle.findFirst(args),
      },
      economicEvent: {
        findMany: async () => {
          calls.database();
          return [];
        },
        findFirst: async () => {
          calls.database();
          return { captured_at: Math.floor(Date.now() / 1000) - 60 };
        },
      },
    },
  };
}

// ---- the network ------------------------------------------------------------

export const KNOWLEDGE_URL = 'https://knowledge.example.internal';
export const KNOWLEDGE_KEY = 'k-knowledge-secret-5521';
export const MODEL_KEY = 'sk-or-v1-model-secret-8842';
export const MODEL_NAME = 'test-vendor/test-model';

export const ENV = {
  INTAKE_ENABLED: 'true',
  KNOWLEDGE_SERVICE_URL: KNOWLEDGE_URL,
  KNOWLEDGE_SERVICE_KEY: KNOWLEDGE_KEY,
  INTAKE_UNDERSTAND_API_KEY: MODEL_KEY,
  INTAKE_UNDERSTAND_MODEL: MODEL_NAME,
};

export interface Network {
  /** what the model says about a question; return a string to send text as it is */
  model: (question: string) => unknown;
  /** the answer of the knowledge service, or a status to answer with */
  knowledge: () => unknown | number;
  modelCalls: { url: string; init: RequestInit; question: string }[];
  knowledgeCalls: {
    url: string;
    init: RequestInit;
    body: Record<string, unknown>;
  }[];
}

export const sampleChunk = (id = 'D1-LEVELS') => ({
  id,
  domain: 'D1',
  mcd_id: null,
  state_codes: [],
  timeframe: null,
  version: '1.0.0',
  text: 'TEST ONLY. UOEDT is the upper edge of the corridor.',
});

export const network: Network = {
  model: (question) => ({
    schema: 'understand-result/1',
    language: 'en',
    english: question,
    intent: 'DIRECTION',
    symbols: ['XAUUSD'],
    timeframes: [],
  }),
  knowledge: () => ({
    status: 'OK',
    index_build_id: 'build-0001',
    chunks: [sampleChunk()],
    expansions: [],
  }),
  modelCalls: [],
  knowledgeCalls: [],
};

export function resetNetwork(): void {
  network.modelCalls.length = 0;
  network.knowledgeCalls.length = 0;
  network.model = (question) => ({
    schema: 'understand-result/1',
    language: 'en',
    english: question,
    intent: 'DIRECTION',
    symbols: ['XAUUSD'],
    timeframes: [],
  });
  network.knowledge = () => ({
    status: 'OK',
    index_build_id: 'build-0001',
    chunks: [sampleChunk()],
    expansions: [],
  });
}

/** Replace `fetch` for the model and the knowledge service; anything else is an error. */
export function installFetch(): jest.SpyInstance {
  return jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/chat/completions')) {
        const body = JSON.parse(String(init?.body)) as {
          messages: { role: string; content: string }[];
        };
        const question = (
          JSON.parse(body.messages[1]?.content ?? '{}') as { question: string }
        ).question;
        network.modelCalls.push({ url, init: init as RequestInit, question });
        const said = network.model(question);
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    typeof said === 'string' ? said : JSON.stringify(said),
                },
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.startsWith(KNOWLEDGE_URL)) {
        network.knowledgeCalls.push({
          url,
          init: init as RequestInit,
          body: JSON.parse(String(init?.body)) as Record<string, unknown>,
        });
        const answer = network.knowledge();
        return typeof answer === 'number'
          ? new Response('{}', { status: answer })
          : new Response(JSON.stringify(answer), { status: 200 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
}

// ---- requests ---------------------------------------------------------------

export function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
