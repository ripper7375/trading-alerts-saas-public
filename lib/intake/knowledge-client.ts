/**
 * The client of the knowledge service (architecture 4.2 step 7, 4.7, 7.6; plan part 5,
 * decisions D3 (A), D9 (d) and D11).
 *
 * The knowledge service is a separate Python process (txtai needs torch, so it cannot live in
 * the Vercel monolith; part 6 builds it). This file is the monolith's side of the one call it
 * makes to it, behind `KnowledgePort` so the pipeline never names a URL:
 *
 *     POST {KNOWLEDGE_SERVICE_URL}/search
 *     X-Knowledge-Service-Key: {KNOWLEDGE_SERVICE_KEY}
 *     { "schema": "knowledge-search/1", "intent": "DIRECTION", "question_en": "...",
 *       "m_star": ["MCD1", "MCD3"], "state_codes": ["MCD1_UP_IN_CORRIDOR", ...],
 *       "routing_version": "routing-v1" }
 *
 *     200 { "status": "OK" | "EMPTY" | "UNAVAILABLE", "index_build_id": ..., "chunks": [...], "expansions": [...] }
 *
 * The answer is the `knowledge` section of `intake-packet/1`, nothing more: the service reads the
 * domains and the D2 scoping of each intent from `dispatch-matrix.v1.json` (the router's
 * `domains` and `playbooks` say the same), builds its SQL with bound, whitelisted ids, and
 * ranks. Anything else it sends is refused with the whole answer.
 *
 * It never throws and never lets a failure reach the trader (7.6, "knowledge index won't load"):
 * a service that is not configured, does not answer in time, answers an error or something that
 * is not a knowledge pack gives `knowledge.status = UNAVAILABLE` (no chunks, no build id) and a
 * problem CODE for the trace. The packet is still built; Section 5 says the pack is missing.
 *
 * The key travels in a header, never in the URL or the body, and appears in no message, problem
 * or log line. The request is not redirected (a redirect would carry the key to another host).
 * The URL must be https, or http on this machine (a development service).
 *
 * Imported BY PATH, never through the `lib/intake` barrel: it calls the network and uses a timer.
 *
 * @module lib/intake/knowledge-client
 */

import 'server-only';

import type { PacketIntent } from './intents';
import { validateKnowledge, type Knowledge } from './packet';

export const KNOWLEDGE_SEARCH_SCHEMA = 'knowledge-search/1';
/** The header the shared secret travels in. */
export const KNOWLEDGE_KEY_HEADER = 'x-knowledge-service-key';
/** The wait for the service: retrieval is a small step of a request that has a budget (5.11). */
export const KNOWLEDGE_TIMEOUT_MS = 2_000;
/** The largest answer read: a pack is at most 12 chunks of 4,000 characters. */
export const KNOWLEDGE_MAX_RESPONSE_CHARS = 262_144;

/** What retrieval is asked: the English question and where to look for it. */
export interface KnowledgeRequest {
  intent: PacketIntent;
  /** the English pivot (typed), or the fixed English question of the instant label */
  question_en: string;
  /** the sensors given in full; the D2 playbooks are scoped to them */
  m_star: string[];
  /** the state codes the sensors of M* are in, in the order of M* */
  state_codes: string[];
  /** the matrix that routed the request: the service refuses one it does not know */
  routing_version: string;
}

export interface KnowledgeResult {
  knowledge: Knowledge;
  /** codes of what failed; empty when the service answered a pack */
  problems: string[];
}

export interface KnowledgePort {
  /** Never rejects: a failure is an UNAVAILABLE pack. */
  search(request: KnowledgeRequest): Promise<KnowledgeResult>;
}

export function unavailableKnowledge(): Knowledge {
  return {
    status: 'UNAVAILABLE',
    index_build_id: null,
    chunks: [],
    expansions: [],
  };
}

const unavailable = (...problems: string[]): KnowledgeResult => ({
  knowledge: unavailableKnowledge(),
  problems,
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface KnowledgeConfig {
  /** the service's base URL; the call goes to `/search` under it */
  url: string;
  /** the shared secret */
  key: string;
  timeoutMs?: number;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * The search endpoint for a base URL, or null when the URL is not one this client will call:
 * not a URL, not http(s), carrying a user name or password, or plain http to another machine.
 */
export function searchEndpoint(base: string): URL | null {
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return null;
  }
  if (url.username !== '' || url.password !== '') return null;
  if (url.protocol === 'https:') {
    // fine
  } else if (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname)) {
    // a development service on this machine
  } else {
    return null;
  }
  url.hash = '';
  url.search = '';
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/search`;
  return url;
}

/** The configuration from the environment, or null when either variable is missing or empty. */
export function knowledgeConfigFromEnv(
  env: Readonly<Record<string, string | undefined>>
): KnowledgeConfig | null {
  const url = env['KNOWLEDGE_SERVICE_URL'];
  const key = env['KNOWLEDGE_SERVICE_KEY'];
  if (
    typeof url !== 'string' ||
    url.trim() === '' ||
    typeof key !== 'string' ||
    key === ''
  ) {
    return null;
  }
  return { url: url.trim(), key };
}

// ---------------------------------------------------------------------------
// The client
// ---------------------------------------------------------------------------

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const isAbort = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  (error as { name: unknown }).name === 'AbortError';

/**
 * The client. `config` null means "not configured": every search is an UNAVAILABLE pack and
 * nothing is sent. `fetchImpl` is the platform's `fetch`; a test passes its own.
 */
export function createKnowledgeClient(
  config: KnowledgeConfig | null,
  fetchImpl: FetchLike = fetch as FetchLike
): KnowledgePort {
  const endpoint = config === null ? null : searchEndpoint(config.url);
  return {
    async search(request: KnowledgeRequest): Promise<KnowledgeResult> {
      if (config === null) return unavailable('KNOWLEDGE_NOT_CONFIGURED');
      if (endpoint === null) return unavailable('KNOWLEDGE_URL_REFUSED');

      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        config.timeoutMs ?? KNOWLEDGE_TIMEOUT_MS
      );
      let text: string;
      try {
        const response = await fetchImpl(endpoint.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            [KNOWLEDGE_KEY_HEADER]: config.key,
          },
          body: JSON.stringify({
            schema: KNOWLEDGE_SEARCH_SCHEMA,
            intent: request.intent,
            question_en: request.question_en,
            m_star: request.m_star,
            state_codes: request.state_codes,
            routing_version: request.routing_version,
          }),
          signal: controller.signal,
          cache: 'no-store',
          redirect: 'error',
        });
        if (!response.ok)
          return unavailable(`KNOWLEDGE_HTTP_${response.status}`);
        const declared = response.headers.get('content-length');
        if (
          declared !== null &&
          /^[0-9]+$/.test(declared) &&
          Number(declared) > KNOWLEDGE_MAX_RESPONSE_CHARS
        ) {
          return unavailable('KNOWLEDGE_RESPONSE_TOO_LARGE');
        }
        text = await response.text();
      } catch (error) {
        return unavailable(
          isAbort(error) ? 'KNOWLEDGE_TIMEOUT' : 'KNOWLEDGE_UNREACHABLE'
        );
      } finally {
        clearTimeout(timer);
      }

      if (text.length > KNOWLEDGE_MAX_RESPONSE_CHARS) {
        return unavailable('KNOWLEDGE_RESPONSE_TOO_LARGE');
      }
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        return unavailable('KNOWLEDGE_BAD_JSON');
      }
      const checked = validateKnowledge(body);
      if (!checked.ok) return unavailable('KNOWLEDGE_BAD_SHAPE');
      return {
        knowledge: checked.knowledge,
        problems:
          checked.knowledge.status === 'UNAVAILABLE'
            ? ['KNOWLEDGE_INDEX_UNAVAILABLE']
            : [],
      };
    },
  };
}
