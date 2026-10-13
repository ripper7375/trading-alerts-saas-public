/**
 * @jest-environment node
 */

/**
 * The knowledge service against the monolith (build step 6 part 6; architecture 4.7 and 4.11 items 5 and 6).
 *
 * `knowledge-service/tests/fixtures/contract/search-responses.json` holds real answers of the Python service,
 * recorded from its own test run on the TEST ONLY corpus (`WRITE_CONTRACT_FIXTURES=yes pytest
 * tests/test_contract.py` records them again). Here the monolith's own validator and its own client read them: a
 * change on one side that the other would refuse fails in both suites. The Python suite also reads `packet.ts`.
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  KNOWLEDGE_KEY_HEADER,
  KNOWLEDGE_SEARCH_SCHEMA,
  createKnowledgeClient,
  type KnowledgeRequest,
} from '@/lib/intake/knowledge-client';
import {
  KNOWLEDGE_CHUNK_MAX_CHARS,
  KNOWLEDGE_MAX_CHUNKS,
  KNOWLEDGE_MAX_EXPANSIONS,
  validateKnowledge,
} from '@/lib/intake/packet';

interface RecordedChunk {
  id: string;
  domain: string;
  mcd_id: string | null;
  state_codes: string[];
  timeframe: string | null;
  version: string;
  text: string;
}

interface RecordedPack {
  status: string;
  index_build_id: string | null;
  chunks: RecordedChunk[];
  expansions: RecordedChunk[];
}

interface Sample {
  name: string;
  request: {
    m_star: string[];
    [key: string]: unknown;
  } | null;
  http_status: number;
  response: RecordedPack;
}

const FILE = path.join(
  process.cwd(),
  'knowledge-service',
  'tests',
  'fixtures',
  'contract',
  'search-responses.json'
);
const document = JSON.parse(fs.readFileSync(FILE, 'utf8')) as {
  schema: string;
  corpus_kind: string;
  samples: Sample[];
};
const byName = (name: string): Sample => {
  const found = document.samples.find((s) => s.name === name);
  if (!found) throw new Error(`no sample ${name}`);
  return found;
};

describe('the recorded answers of the knowledge service', () => {
  it('are the service’s own, on the test corpus', () => {
    expect(document.schema).toBe('knowledge-service-samples/1');
    expect(document.corpus_kind).toBe('TEST_ONLY');
    expect(document.samples.map((s) => s.name)).toEqual([
      'ok_direction_with_playbook',
      'ok_explain_foundations',
      'ok_instant_with_expansion',
      'empty_report_2',
      'unavailable_503',
    ]);
  });

  it.each(document.samples.map((s) => [s.name, s] as const))(
    '%s is accepted by validateKnowledge',
    (_name, sample) => {
      expect(validateKnowledge(sample.response).ok).toBe(true);
    }
  );

  it('have exactly the four fields and chunks of exactly seven', () => {
    for (const sample of document.samples) {
      expect(Object.keys(sample.response).sort()).toEqual([
        'chunks',
        'expansions',
        'index_build_id',
        'status',
      ]);
      for (const chunk of [
        ...sample.response.chunks,
        ...sample.response.expansions,
      ]) {
        expect(Object.keys(chunk).sort()).toEqual([
          'domain',
          'id',
          'mcd_id',
          'state_codes',
          'text',
          'timeframe',
          'version',
        ]);
        expect(chunk.text.length).toBeLessThanOrEqual(
          KNOWLEDGE_CHUNK_MAX_CHARS
        );
      }
    }
  });

  it('keep the limits of the pack', () => {
    for (const sample of document.samples) {
      expect(sample.response.chunks.length).toBeLessThanOrEqual(
        KNOWLEDGE_MAX_CHUNKS
      );
      expect(sample.response.expansions.length).toBeLessThanOrEqual(
        KNOWLEDGE_MAX_EXPANSIONS
      );
    }
  });

  it('show each status the service can answer', () => {
    expect(byName('ok_direction_with_playbook').response.status).toBe('OK');
    expect(byName('empty_report_2').response.status).toBe('EMPTY');
    expect(byName('unavailable_503').response.status).toBe('UNAVAILABLE');
    expect(byName('unavailable_503').http_status).toBe(503);
    expect(byName('unavailable_503').response.index_build_id).toBeNull();
    // OK and EMPTY name the build the packet traces
    expect(byName('empty_report_2').response.index_build_id).toMatch(
      /^kb-[0-9a-f]{32}$/
    );
  });

  it('include an answer with cross-referenced chunks', () => {
    expect(
      byName('ok_instant_with_expansion').response.expansions.length
    ).toBeGreaterThan(0);
  });

  it('keep a playbook chunk inside the sensors of M*', () => {
    for (const name of [
      'ok_direction_with_playbook',
      'ok_instant_with_expansion',
    ]) {
      const sample = byName(name);
      const mStar = sample.request?.m_star ?? [];
      const all = [...sample.response.chunks, ...sample.response.expansions];
      for (const chunk of all) {
        if (chunk.domain === 'D2') expect(mStar).toContain(chunk.mcd_id);
      }
    }
  });
});

describe('the monolith’s client reading those answers', () => {
  const REQUEST: KnowledgeRequest = {
    intent: 'DIRECTION',
    question_en: 'What does a breakout above the upper band mean?',
    m_star: ['MCD1', 'MCD3'],
    state_codes: ['MCD1_UP_UPPER_BREAKOUT'],
    routing_version: 'routing-v1',
  };

  const serving = (sample: Sample) => {
    const calls: { url: string; init: RequestInit }[] = [];
    const client = createKnowledgeClient(
      { url: 'https://knowledge.example.internal', key: 'k' },
      async (url, init) => {
        calls.push({ url, init });
        return new Response(JSON.stringify(sample.response), {
          status: sample.http_status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    );
    return { client, calls };
  };

  it.each(
    document.samples
      .filter((s) => s.http_status === 200)
      .map((s) => [s.name, s] as const)
  )('takes %s as the pack it is', async (_name, sample) => {
    const { client } = serving(sample);
    const result = await client.search(REQUEST);
    expect(result.problems).toEqual([]);
    expect(result.knowledge).toEqual(sample.response);
  });

  it('turns the 503 into an UNAVAILABLE pack with the code of the status', async () => {
    const { client } = serving(byName('unavailable_503'));
    const result = await client.search(REQUEST);
    expect(result.knowledge).toEqual(byName('unavailable_503').response);
    expect(result.problems).toEqual(['KNOWLEDGE_HTTP_503']);
  });

  it('sends the request the service accepts, with the key in the header only', async () => {
    const { client, calls } = serving(byName('ok_explain_foundations'));
    await client.search(REQUEST);
    const call = calls[0];
    if (!call) throw new Error('the client made no call');
    expect(call.url).toBe('https://knowledge.example.internal/search');
    expect(
      (call.init.headers as Record<string, string>)[KNOWLEDGE_KEY_HEADER]
    ).toBe('k');
    const sent = JSON.parse(call.init.body as string) as Record<
      string,
      unknown
    >;
    expect(sent).toEqual({ schema: KNOWLEDGE_SEARCH_SCHEMA, ...REQUEST });
    // the same six fields the recorded requests (the service's own test requests) carry
    const recorded = byName('ok_direction_with_playbook').request ?? {};
    expect(Object.keys(recorded).sort()).toEqual(Object.keys(sent).sort());
  });
});
