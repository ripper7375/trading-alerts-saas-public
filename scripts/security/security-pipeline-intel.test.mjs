// Run: node --test 'scripts/security/*.test.mjs'
//
// The enrichment feeds of the private security pipeline, with an injected fetch:
// the JSON cache, conditional feeds (KEV, Node index), EPSS batching, OSV batch
// queries and records, the findings built from OSV, and the Dependabot reader.
// Identifiers and package names are invented.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptedIgnoreFindings,
  createJsonCache,
  enrichFinding,
  fetchEpss,
  fetchFeed,
  fetchKev,
  fetchNodeFeed,
  groupByAlias,
  maliciousFinding,
  osvGetVulns,
  osvQueryBatch,
  parseGitCredential,
  pipFindingsFromOsv,
  readDependabotAlerts,
  reduceKev,
  reduceOsvRecord,
  resolveGithubToken,
  request,
  URLS,
} from './security-pipeline-intel.mjs';
import { makeFinding } from './security-pipeline-matchers.mjs';

const GHSA = 'GHSA-aaaa-bbbb-cccc';
const GHSA_2 = 'GHSA-dddd-eeee-ffff';
const CVE = 'CVE-2099-0001';
const CVE_2 = 'CVE-2099-0002';
const PYSEC = 'PYSEC-2099-1';
const MAL = 'MAL-2099-0001';

// --- helpers -----------------------------------------------------------------------

function memoryFs() {
  const files = new Map();
  return {
    files,
    readText: (path) => files.get(path) ?? null,
    writeText: (path, text) => void files.set(path, text),
    mkdirp: () => {},
  };
}

function makeDeps({ handler, start = '2026-11-21T12:00:00Z' } = {}) {
  const fs = memoryFs();
  const clock = { t: Date.parse(start) };
  const calls = [];
  const deps = {
    fs,
    clock,
    calls,
    now: () => new Date(clock.t),
    sleep: async () => {},
    cache: createJsonCache({ dir: '/cache', fs }),
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      return handler(String(url), init, calls.length);
    },
  };
  return deps;
}

const json = (data, { status = 200, headers = {} } = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
const notModified = () => new Response(null, { status: 304 });

// --- cache -----------------------------------------------------------------------------

test('createJsonCache round-trips JSON, treats corruption as a miss and refuses odd names', () => {
  const fs = memoryFs();
  const cache = createJsonCache({ dir: '/c', fs });
  assert.equal(cache.read('kev'), null);
  assert.equal(cache.write('kev', { a: 1 }), true);
  assert.deepEqual(cache.read('kev'), { a: 1 });
  fs.files.set('/c/kev.json', '{not json');
  assert.equal(cache.read('kev'), null);
  // a name that could leave the folder is never read or written
  assert.equal(cache.read('../escape'), null);
  assert.equal(cache.write('a/b', {}), false);
  assert.equal(cache.write('../escape', {}), false);
  assert.deepEqual([...fs.files.keys()], ['/c/kev.json']);
  const broken = createJsonCache({
    dir: '/c',
    fs: {
      readText: () => null,
      writeText: () => {
        throw new Error('disk full');
      },
      mkdirp: () => {},
    },
  });
  assert.equal(
    broken.write('x', {}),
    false,
    'a cache that cannot be written never throws'
  );
});

// --- request ----------------------------------------------------------------------------

test('request retries once on a network error or a 5xx and never throws', async () => {
  let attempts = 0;
  const deps = makeDeps({
    handler: () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError('fetch failed');
      return json({ ok: true });
    },
  });
  const ok = await request(deps, 'https://example.test/x');
  assert.equal(ok.ok, true);
  assert.equal(attempts, 2);

  const down = makeDeps({ handler: () => json({}, { status: 503 }) });
  const failed = await request(down, 'https://example.test/x');
  assert.equal(failed.ok, false);
  assert.equal(failed.error, 'http_503');
  assert.equal(down.calls.length, 2);

  const dead = makeDeps({
    handler: () => {
      throw new TypeError('fetch failed');
    },
  });
  assert.deepEqual(
    (({ ok, error }) => ({ ok, error }))(
      await request(dead, 'https://example.test/x')
    ),
    {
      ok: false,
      error: 'network_error',
    }
  );
  const notFound = makeDeps({ handler: () => json({}, { status: 404 }) });
  assert.equal(
    (await request(notFound, 'https://example.test/x')).error,
    'http_404'
  );
  assert.equal(notFound.calls.length, 1, 'a 404 is not retried');
});

// --- conditional feeds ------------------------------------------------------------------------

const KEV_JSON = {
  catalogVersion: '2026.11.20',
  vulnerabilities: [
    { cveID: CVE },
    { cveID: 'cve-2099-0003' },
    { cveID: 'not-an-id' },
    {},
  ],
};

test('reduceKev keeps well-formed CVE identifiers only', () => {
  assert.deepEqual(reduceKev(KEV_JSON), {
    catalogVersion: '2026.11.20',
    count: 2,
    cves: [CVE, 'CVE-2099-0003'],
  });
  assert.equal(reduceKev({}), null);
  assert.equal(reduceKev({ vulnerabilities: [] }), null);
  assert.equal(reduceKev(null), null);
});

test('fetchKev: a fresh fetch is cached; within the TTL no request; after it a conditional request', async () => {
  let mode = 'full';
  const deps = makeDeps({
    handler: (url, init) => {
      assert.equal(url, URLS.kev);
      if (mode === 'conditional') {
        assert.equal(init.headers['If-None-Match'], '"etag-1"');
        return notModified();
      }
      return json(KEV_JSON, {
        headers: {
          etag: '"etag-1"',
          'last-modified': 'Fri, 20 Nov 2026 17:48:39 GMT',
        },
      });
    },
  });
  const first = await fetchKev({ deps });
  assert.equal(first.status, 'fresh');
  assert.equal(first.data.cves.length, 2);
  assert.equal(deps.calls.length, 1);

  deps.clock.t += 60 * 60 * 1000; // one hour later: inside the 6 h TTL
  assert.equal((await fetchKev({ deps })).status, 'cache_fresh');
  assert.equal(deps.calls.length, 1);

  deps.clock.t += 7 * 60 * 60 * 1000;
  mode = 'conditional';
  const third = await fetchKev({ deps });
  assert.equal(third.status, 'not_modified');
  assert.equal(third.data.cves.length, 2);
  assert.equal(deps.calls.length, 2);

  // --refresh ignores the TTL but still asks conditionally
  const forced = await fetchKev({ deps, refresh: true });
  assert.equal(forced.status, 'not_modified');
  assert.equal(deps.calls.length, 3);
});

test('fetchFeed falls back to the stale cache, and reports unavailable without one', async () => {
  let up = true;
  const deps = makeDeps({
    handler: () =>
      up
        ? json(KEV_JSON, { headers: { etag: '"e"' } })
        : json({}, { status: 503 }),
  });
  assert.equal((await fetchKev({ deps })).status, 'fresh');
  up = false;
  deps.clock.t += 24 * 60 * 60 * 1000;
  const stale = await fetchKev({ deps });
  assert.equal(stale.status, 'stale_cache');
  assert.equal(stale.detail, 'http_503');
  assert.equal(stale.data.count, 2);

  const empty = makeDeps({ handler: () => json({}, { status: 503 }) });
  const none = await fetchKev({ deps: empty });
  assert.equal(none.status, 'unavailable');
  assert.equal(none.data, null);
});

test('fetchFeed offline uses the cache only and makes no request', async () => {
  const deps = makeDeps({ handler: () => assert.fail('no request offline') });
  assert.equal((await fetchKev({ deps, offline: true })).status, 'unavailable');
  deps.cache.write('kev', {
    etag: null,
    fetchedAt: '2026-11-01T00:00:00Z',
    data: { cves: [CVE], count: 1 },
  });
  const result = await fetchKev({ deps, offline: true });
  assert.equal(result.status, 'cache_offline');
  assert.equal(result.data.count, 1);
  assert.equal(deps.calls.length, 0);
});

test('fetchFeed treats an unreadable or unexpected body as unavailable', async () => {
  const bad = makeDeps({
    handler: () => new Response('<html>', { status: 200 }),
  });
  assert.equal((await fetchKev({ deps: bad })).detail, 'invalid_json');
  const odd = makeDeps({ handler: () => json({ vulnerabilities: [] }) });
  assert.equal((await fetchKev({ deps: odd })).detail, 'unexpected_shape');
  const throwing = makeDeps({ handler: () => json({}) });
  const result = await fetchFeed({
    deps: throwing,
    url: 'https://example.test',
    cacheName: 'x',
    reduce: () => {
      throw new Error('boom');
    },
  });
  assert.equal(result.status, 'unavailable');
});

test('fetchNodeFeed reduces the release index to the latest and latest security release per line', async () => {
  const deps = makeDeps({
    handler: () =>
      json([
        { version: 'v24.23.0', date: '2026-11-18', security: false },
        { version: 'v24.22.3', date: '2026-11-11', security: true },
        { version: 'v22.23.5', date: '2026-11-11', security: true },
      ]),
  });
  const result = await fetchNodeFeed({ deps });
  assert.equal(result.status, 'fresh');
  assert.equal(result.data['24'].latestSecurity, '24.22.3');
  assert.equal(result.data['24'].latest, '24.23.0');
  assert.equal(result.data['22'].latestSecurity, '22.23.5');
  assert.equal(deps.calls[0].url, URLS.nodeIndex);
});

// --- EPSS --------------------------------------------------------------------------------------

const cveList = (n) =>
  Array.from(
    { length: n },
    (_, i) => `CVE-2099-${String(i + 1).padStart(4, '0')}`
  );

test('fetchEpss batches the CVE list, validates values and caches for the UTC day', async () => {
  const deps = makeDeps({
    handler: (url) => {
      const asked = new URL(url).searchParams.get('cve').split(',');
      return json({
        status: 'OK',
        data: asked
          .filter((cve) => cve !== 'CVE-2099-0003') // no score for this one
          .map((cve) => ({
            cve,
            epss: cve === CVE ? '0.4' : '0.01',
            percentile: '0.5',
            date: '2026-11-21',
          })),
      });
    },
  });
  const cves = [...cveList(170), 'not-a-cve', CVE.toLowerCase()];
  const result = await fetchEpss({ deps, cves });
  assert.equal(result.status, 'fresh');
  assert.equal(deps.calls.length, 3, '170 CVEs in batches of 80');
  assert.equal(result.scores.get(CVE).score, 0.4);
  assert.equal(result.scores.get(CVE).percentile, 0.5);
  assert.equal(result.scores.has('CVE-2099-0003'), false);

  const again = await fetchEpss({ deps, cves });
  assert.equal(again.status, 'cache_fresh');
  assert.equal(
    deps.calls.length,
    3,
    'the same UTC day is served from the cache'
  );

  deps.clock.t += 24 * 60 * 60 * 1000;
  assert.equal((await fetchEpss({ deps, cves: [CVE] })).status, 'fresh');
  assert.equal(deps.calls.length, 4, 'a new day asks again');
});

test('fetchEpss ignores out-of-range values and degrades on failure', async () => {
  const odd = makeDeps({
    handler: () =>
      json({
        data: [
          { cve: CVE, epss: '7', percentile: '0.1' },
          { cve: CVE_2, epss: '0.2', percentile: '9' },
        ],
      }),
  });
  const result = await fetchEpss({ deps: odd, cves: [CVE, CVE_2] });
  assert.equal(result.scores.has(CVE), false);
  assert.equal(result.scores.get(CVE_2).percentile, null);

  const down = makeDeps({ handler: () => json({}, { status: 500 }) });
  const failed = await fetchEpss({ deps: down, cves: [CVE] });
  assert.equal(failed.status, 'unavailable');
  assert.equal(failed.scores.size, 0);

  const none = await fetchEpss({ deps: down, cves: [] });
  assert.equal(none.status, 'no_cves');

  const offline = await fetchEpss({
    deps: makeDeps({ handler: () => assert.fail('offline') }),
    cves: [CVE],
    offline: true,
  });
  assert.equal(offline.status, 'unavailable');
});

// --- OSV batch and records -------------------------------------------------------------------------

test('osvQueryBatch chunks at 1000 queries, keeps the order and follows page tokens', async () => {
  const queries = Array.from({ length: 1500 }, (_, i) => ({
    ecosystem: 'npm',
    name: `pkg-${i}`,
    version: '1.0.0',
  }));
  const deps = makeDeps({
    handler: (url, init) => {
      assert.equal(url, `${URLS.osv}/v1/querybatch`);
      const body = JSON.parse(init.body);
      return json({
        results: body.queries.map((q) => {
          if (q.page_token) return { vulns: [{ id: 'GHSA-page-2' }] };
          if (q.package.name === 'pkg-7')
            return { vulns: [{ id: MAL }], next_page_token: 'tok' };
          if (q.package.name === 'pkg-1200') return { vulns: [{ id: GHSA }] };
          return {};
        }),
      });
    },
  });
  const result = await osvQueryBatch({ deps, queries });
  assert.equal(result.status, 'ok');
  assert.equal(result.results.length, 1500);
  assert.deepEqual(
    result.results[7].map((v) => v.id),
    [MAL, 'GHSA-page-2']
  );
  assert.deepEqual(
    result.results[1200].map((v) => v.id),
    [GHSA]
  );
  assert.deepEqual(result.results[0], []);
  // two chunks, plus one page-token round for the first
  assert.equal(deps.calls.length, 3);
});

test('osvQueryBatch reports a failed or malformed response, and skips offline', async () => {
  const queries = [{ ecosystem: 'npm', name: 'a', version: '1.0.0' }];
  const down = makeDeps({ handler: () => json({}, { status: 503 }) });
  assert.equal(
    (await osvQueryBatch({ deps: down, queries })).status,
    'unavailable'
  );
  const wrong = makeDeps({ handler: () => json({ results: [] }) });
  assert.equal(
    (await osvQueryBatch({ deps: wrong, queries })).detail,
    'unexpected_shape'
  );
  const offline = await osvQueryBatch({
    deps: makeDeps({ handler: () => assert.fail('offline') }),
    queries,
    offline: true,
  });
  assert.equal(offline.status, 'skipped_offline');
});

const OSV_RAW = {
  id: GHSA,
  modified: '2026-11-18T10:00:00Z',
  aliases: [CVE],
  summary: 'Sentinel summary',
  details: 'long details that must be dropped',
  severity: [
    { type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' },
  ],
  database_specific: { severity: 'CRITICAL', cwe_ids: ['CWE-94'] },
  affected: [
    {
      package: { ecosystem: 'npm', name: 'sentinel-pkg' },
      ranges: [
        {
          type: 'SEMVER',
          events: [
            { introduced: '0' },
            { fixed: '1.2.3' },
            { introduced: '2.0.0' },
            { last_affected: '2.4.0' },
          ],
        },
      ],
    },
  ],
};

test('reduceOsvRecord keeps identifiers, severity, CWEs and the vulnerable windows', () => {
  const record = reduceOsvRecord(OSV_RAW);
  assert.equal(record.id, GHSA);
  assert.deepEqual(record.aliases, [CVE]);
  assert.equal(record.severityLabel, 'critical');
  assert.equal(record.cvss, 9.8);
  assert.deepEqual(record.cwes, [94]);
  assert.equal(record.withdrawn, null);
  assert.equal('details' in record, false);
  assert.deepEqual(record.affected[0].windows, [
    { range: '>=0.0.0 <1.2.3', fixed: '1.2.3' },
    { range: '>=2.0.0 <=2.4.0', fixed: null },
  ]);
  assert.equal(
    reduceOsvRecord({ withdrawn: '2026-11-16T00:00:00Z', id: GHSA }).withdrawn,
    '2026-11-16T00:00:00Z'
  );
  assert.equal(reduceOsvRecord({}), null);
  assert.equal(reduceOsvRecord(null), null);
});

test('osvGetVulns caches records for 24 h, caches a 404 as null, and counts failures', async () => {
  const deps = makeDeps({
    handler: (url) => {
      if (url.endsWith(GHSA)) return json(OSV_RAW);
      if (url.endsWith(GHSA_2))
        return json({ error: 'not found' }, { status: 404 });
      if (url.endsWith(MAL)) return json({}, { status: 500 });
      return json({ id: url.split('/').pop() });
    },
  });
  const first = await osvGetVulns({
    deps,
    ids: [GHSA, GHSA_2, MAL, GHSA, 'bad id with spaces'],
  });
  assert.equal(first.records.get(GHSA).id, GHSA);
  assert.equal(first.records.get(GHSA_2), null);
  assert.equal(first.records.has(MAL), false);
  assert.equal(first.failed, 2);
  assert.equal(first.status, 'partial');

  const calls = deps.calls.length;
  const second = await osvGetVulns({ deps, ids: [GHSA, GHSA_2] });
  assert.equal(second.status, 'ok');
  assert.equal(
    deps.calls.length,
    calls,
    'inside 24 h nothing is fetched again'
  );

  deps.clock.t += 25 * 60 * 60 * 1000;
  await osvGetVulns({ deps, ids: [GHSA] });
  assert.equal(deps.calls.length, calls + 1);

  const offline = await osvGetVulns({
    deps,
    ids: [GHSA, 'GHSA-zzzz-zzzz-zzzz'],
    offline: true,
  });
  assert.equal(
    offline.records.get(GHSA).id,
    GHSA,
    'offline serves any cached record, however old'
  );
  assert.equal(offline.failed, 1);
});

// --- OSV -> findings ----------------------------------------------------------------------------------

const record = (over) =>
  reduceOsvRecord({ modified: '2026-11-18T10:00:00Z', ...over });

test('groupByAlias merges a GHSA with its CVE and PYSEC twins', () => {
  const groups = groupByAlias([
    record({ id: GHSA, aliases: [CVE, PYSEC] }),
    record({ id: PYSEC, aliases: [CVE] }),
    record({ id: GHSA_2, aliases: [CVE_2] }),
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((g) => g.length).sort(), [1, 2]);
});

test('pipFindingsFromOsv: one finding per alias group with merged identifiers, severity and fixes', () => {
  const ghsa = record({
    id: GHSA,
    aliases: [CVE, PYSEC],
    summary: 'Sentinel summary',
    database_specific: { severity: 'HIGH', cwe_ids: ['CWE-1333'] },
    severity: [
      {
        type: 'CVSS_V3',
        score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H',
      },
    ],
    affected: [
      {
        package: { ecosystem: 'PyPI', name: 'sentinel-lib' },
        ranges: [
          {
            type: 'ECOSYSTEM',
            events: [{ introduced: '0' }, { fixed: '2.32.0' }],
          },
        ],
      },
    ],
  });
  const pysec = record({ id: PYSEC, aliases: [CVE], affected: [] });
  const findings = pipFindingsFromOsv({
    assetId: 'knowledge-service',
    pkg: { name: 'sentinel-lib', version: '2.31.0' },
    records: [ghsa, pysec],
  });
  assert.equal(findings.length, 1);
  const [f] = findings;
  assert.deepEqual(f.advisoryIds, [GHSA, CVE, PYSEC]);
  assert.equal(f.primaryId, GHSA);
  assert.equal(f.severity, 'high');
  assert.equal(f.cvss, 7.5);
  assert.deepEqual(f.fixedVersions, ['2.32.0']);
  assert.equal(f.fixKnown, true);
  assert.equal(f.ecosystem, 'pip');
  assert.equal(f.direct, true);
  assert.equal(f.scope, 'runtime');
  assert.equal(f.vulnClass, 'dos');
  assert.equal(f.withdrawn, false);
});

test('pipFindingsFromOsv: no stated severity is assumed moderate; test tooling is dev-only; withdrawn is kept', () => {
  const bare = record({
    id: PYSEC,
    aliases: [],
    withdrawn: '2026-11-16T00:00:00Z',
  });
  const [f] = pipFindingsFromOsv({
    assetId: 'mt5-service-legacy',
    pkg: { name: 'pytest', version: '7.4.3' },
    records: [bare],
  });
  assert.equal(f.severity, 'moderate');
  assert.equal(f.severityAssumed, true);
  assert.equal(f.scope, 'dev_only');
  assert.equal(f.withdrawn, true);
  assert.equal(f.fixKnown, false);
});

test('maliciousFinding is a critical, malicious runtime finding', () => {
  const f = maliciousFinding({
    assetId: 'monolith-web',
    ecosystem: 'npm',
    pkg: { name: 'sentinel-pkg', version: '1.0.0' },
    record: record({
      id: MAL,
      aliases: [],
      summary: 'Malicious code in sentinel-pkg',
    }),
  });
  assert.equal(f.malicious, true);
  assert.equal(f.severity, 'critical');
  assert.equal(f.primaryId, MAL);
  assert.equal(f.withdrawn, false);
  const withdrawn = maliciousFinding({
    assetId: 'monolith-web',
    ecosystem: 'npm',
    pkg: { name: 'sentinel-pkg', version: '1.0.0' },
    record: record({ id: MAL, aliases: [], withdrawn: '2026-11-16T00:00:00Z' }),
  });
  assert.equal(withdrawn.withdrawn, true);
});

test('acceptedIgnoreFindings resolves muted advisories to lockfile packages', () => {
  const records = new Map([
    [GHSA, reduceOsvRecord(OSV_RAW)],
    [
      GHSA_2,
      record({
        id: GHSA_2,
        aliases: [],
        withdrawn: '2026-11-16T00:00:00Z',
        affected: [],
      }),
    ],
    ['GHSA-gone-gone-gone', null],
  ]);
  const lockKeys = new Set([
    'sentinel-pkg@1.0.0',
    'sentinel-pkg@1.5.0',
    'sentinel-pkg@2.2.0',
    'other@1.0.0',
  ]);
  const { findings, entries } = acceptedIgnoreFindings({
    ids: [GHSA, GHSA_2, 'GHSA-gone-gone-gone'],
    records,
    lockKeys,
    assetId: 'monolith-web',
    directNames: new Set(['sentinel-pkg']),
  });
  // 1.0.0 is in the first window, 1.5.0 is fixed, 2.2.0 is in the second window
  assert.deepEqual(findings.map((f) => f.version).sort(), ['1.0.0', '2.2.0']);
  for (const f of findings) {
    assert.equal(f.acceptedIgnore, true);
    assert.equal(f.assetId, 'monolith-web');
    assert.equal(f.direct, true);
    assert.equal(f.severity, 'critical');
  }
  assert.deepEqual(findings.find((f) => f.version === '1.0.0').fixedVersions, [
    '1.2.3',
  ]);
  assert.deepEqual(entries, [
    { id: GHSA, matched: 2, withdrawn: false, record: true },
    { id: GHSA_2, matched: 0, withdrawn: true, record: true },
    { id: 'GHSA-gone-gone-gone', matched: 0, withdrawn: false, record: false },
  ]);
});

// --- enrichment ---------------------------------------------------------------------------------------------

test('enrichFinding adds aliases, KEV, the highest EPSS and the withdrawal', () => {
  const finding = makeFinding({
    assetId: 'money-service',
    packageName: 'sentinel-pkg',
    version: '1.0.0',
    advisoryIds: [GHSA],
    title: 'Sentinel advisory',
    fixedVersions: [],
  });
  const records = new Map([
    [GHSA, reduceOsvRecord({ ...OSV_RAW, aliases: [CVE, CVE_2] })],
  ]);
  const kev = new Set([CVE_2]);
  const epss = new Map([
    [CVE, { score: 0.05, percentile: 0.7 }],
    [CVE_2, { score: 0.3, percentile: 0.9 }],
  ]);
  const enriched = enrichFinding(finding, { records, kev, epss });
  assert.deepEqual(enriched.advisoryIds, [GHSA, CVE, CVE_2]);
  assert.equal(enriched.inKev, true);
  assert.equal(enriched.epssScore, 0.3);
  assert.equal(enriched.epssPercentile, 0.9);
  assert.deepEqual(enriched.cwes, [94]);
  assert.equal(enriched.vulnClass, 'rce');
  assert.deepEqual(enriched.fixedVersions, ['1.2.3']);
  assert.equal(enriched.fixKnown, true);
  assert.equal(enriched.withdrawn, false);

  const withdrawn = enrichFinding(finding, {
    records: new Map([
      [
        GHSA,
        reduceOsvRecord({ ...OSV_RAW, withdrawn: '2026-11-16T00:00:00Z' }),
      ],
    ]),
    kev: null,
    epss: new Map(),
  });
  assert.equal(withdrawn.withdrawn, true);
  assert.equal(withdrawn.inKev, false);
  assert.equal(withdrawn.epssScore, null);
});

test('enrichFinding flags a malicious alias but not a withdrawn one', () => {
  const finding = makeFinding({
    assetId: 'a',
    packageName: 'p',
    version: '1.0.0',
    advisoryIds: [MAL],
  });
  const live = enrichFinding(finding, {
    records: new Map([[MAL, record({ id: MAL, aliases: [] })]]),
    kev: new Set(),
    epss: new Map(),
  });
  assert.equal(live.malicious, true);
  const gone = enrichFinding(finding, {
    records: new Map([
      [
        MAL,
        record({ id: MAL, aliases: [], withdrawn: '2026-11-16T00:00:00Z' }),
      ],
    ]),
    kev: new Set(),
    epss: new Map(),
  });
  assert.equal(gone.malicious, false);
  assert.equal(gone.withdrawn, true);
});

// --- Dependabot ----------------------------------------------------------------------------------------------------

const alertRow = (n, over = {}) => ({
  number: n,
  state: 'open',
  dependency: {
    package: { ecosystem: 'npm', name: 'sentinel-pkg' },
    manifest_path: 'money-service/package-lock.json',
    scope: 'runtime',
  },
  security_advisory: {
    ghsa_id: GHSA,
    cve_id: CVE,
    severity: 'high',
    summary: 'must not be kept',
  },
  ...over,
});

test('readDependabotAlerts follows Link headers, keeps only the reconciliation fields and sends the token to GitHub only', async () => {
  const deps = makeDeps({
    handler: (url, init) => {
      assert.equal(new URL(url).origin, 'https://api.github.com');
      if (deps.calls.length === 1) {
        assert.ok(
          url.startsWith(
            'https://api.github.com/repos/ripper7375/trading-alerts-saas-public/dependabot/alerts?state=open&per_page=100'
          )
        );
      }
      assert.equal(init.headers.Authorization, 'Bearer test-token');
      if (!url.includes('page=2')) {
        return json(
          [
            alertRow(1),
            alertRow(2, {
              dependency: {
                package: { ecosystem: 'pip', name: 'p' },
                manifest_path: 'x/requirements.txt',
                scope: 'development',
              },
            }),
          ],
          {
            headers: {
              link: '<https://api.github.com/repositories/1/dependabot/alerts?state=open&per_page=100&page=2>; rel="next"',
            },
          }
        );
      }
      return json([
        alertRow(3, {
          security_advisory: {
            ghsa_id: null,
            cve_id: CVE_2,
            severity: 'moderate',
          },
        }),
      ]);
    },
  });
  const result = await readDependabotAlerts({ deps, token: 'test-token' });
  assert.equal(result.status, 'ok');
  assert.equal(result.alerts.length, 3);
  assert.deepEqual(result.alerts[0], {
    number: 1,
    ghsa: GHSA,
    cve: CVE,
    packageName: 'sentinel-pkg',
    ecosystem: 'npm',
    manifestPath: 'money-service/package-lock.json',
    scope: 'runtime',
    severity: 'high',
  });
  assert.equal(result.alerts[1].scope, 'development');
  assert.equal(result.alerts[2].ghsa, null);
  assert.equal(JSON.stringify(result).includes('must not be kept'), false);
  assert.equal(JSON.stringify(result).includes('test-token'), false);
});

test('readDependabotAlerts reports a refusal, a rate limit and an off-origin next link', async () => {
  const forbidden = makeDeps({
    handler: () => json({ message: 'nope' }, { status: 403 }),
  });
  const refused = await readDependabotAlerts({ deps: forbidden, token: 't' });
  assert.equal(refused.status, 'unavailable');
  assert.equal(refused.detail, 'http_403');

  const limited = makeDeps({
    handler: () =>
      json({}, { status: 403, headers: { 'x-ratelimit-remaining': '0' } }),
  });
  assert.equal(
    (await readDependabotAlerts({ deps: limited, token: 't' })).detail,
    'rate_limited'
  );

  const evil = makeDeps({
    handler: () =>
      json([alertRow(1)], {
        headers: { link: '<https://evil.example/steal>; rel="next"' },
      }),
  });
  const off = await readDependabotAlerts({ deps: evil, token: 't' });
  assert.equal(off.detail, 'next_link_off_origin');
  assert.equal(evil.calls.length, 1, 'the token never goes to the other host');

  const wrong = makeDeps({ handler: () => json({ not: 'a list' }) });
  assert.equal(
    (await readDependabotAlerts({ deps: wrong, token: 't' })).detail,
    'unexpected_shape'
  );
});

test('resolveGithubToken prefers the dedicated token, then GITHUB_TOKEN, then the Git credential', () => {
  const credentialFill = () =>
    'protocol=https\nhost=github.com\nusername=someone\npassword=fake-credential-value\n';
  assert.deepEqual(
    resolveGithubToken({
      secrets: { dependabotToken: 'a', githubToken: 'b' },
      credentialFill,
    }),
    { token: 'a', source: 'DEPENDABOT_TRIAGE_TOKEN' }
  );
  assert.deepEqual(
    resolveGithubToken({ secrets: { githubToken: 'b' }, credentialFill }),
    {
      token: 'b',
      source: 'GITHUB_TOKEN',
    }
  );
  assert.deepEqual(resolveGithubToken({ secrets: {}, credentialFill }), {
    token: 'fake-credential-value',
    source: 'git-credential',
  });
  assert.deepEqual(
    resolveGithubToken({ secrets: {}, credentialFill: () => null }),
    { token: null, source: null }
  );
  assert.deepEqual(
    resolveGithubToken({
      secrets: {},
      credentialFill: () => {
        throw new Error('no helper');
      },
    }),
    { token: null, source: null }
  );
  assert.deepEqual(parseGitCredential('a=1\nb=x=y\n\nnoequals'), {
    a: '1',
    b: 'x=y',
  });
});
