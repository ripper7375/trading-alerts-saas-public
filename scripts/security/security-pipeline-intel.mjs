// Threat-intelligence enrichment for the private security pipeline: OSV (including
// `MAL-` malicious-package records and withdrawals), the CISA KEV catalog, FIRST
// EPSS, the Node.js release index and the Dependabot alerts API.
//
// Every network call goes through an injected `fetchImpl` and a JSON cache that
// lives in the gitignored reports folder, so the module is testable without a
// network and a feed outage degrades the sweep instead of failing it. Responses
// are untrusted data: they are shape-checked, reduced to the fields the engine
// needs and never executed. Nothing here prints; errors are fixed codes.

import {
  classifyVulnerability,
  cvss3Score,
  isPipDevTool,
  makeFinding,
  normalizeSeverity,
  parseCwes,
  severityFromScore,
  severityRank,
} from './security-pipeline-matchers.mjs';
import { reduceNodeIndex } from './security-pipeline-lib.mjs';
import { compareVersions, parseVersion } from './security-semver-lite.mjs';
import {
  DEFAULT_API_BASE,
  DEFAULT_REPO,
  isSameOrigin,
  parseNextLink,
  rateLimitState,
} from './dependabot-triage-lib.mjs';

export const URLS = Object.freeze({
  osv: 'https://api.osv.dev',
  kev: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
  epss: 'https://api.first.org/data/v1/epss',
  nodeIndex: 'https://nodejs.org/dist/index.json',
});

const HOUR = 3600 * 1000;
const unique = (items) => [...new Set(items)];
const asArray = (value) => (Array.isArray(value) ? value : []);

// --- cache ----------------------------------------------------------------------

/**
 * A JSON cache in one folder. `fs` is `{ readText, writeText, mkdirp }`; names
 * are restricted to a safe alphabet so a name can never leave the folder.
 */
export function createJsonCache({ dir, fs }) {
  const pathOf = (name) => {
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) throw new Error('bad_cache_name');
    return `${dir.replace(/[\\/]+$/, '')}/${name}.json`;
  };
  return {
    read(name) {
      try {
        const text = fs.readText(pathOf(name));
        return text ? JSON.parse(text) : null;
      } catch {
        return null; // a corrupt cache file is a cache miss
      }
    },
    write(name, value) {
      try {
        fs.mkdirp(dir);
        fs.writeText(pathOf(name), JSON.stringify(value));
        return true;
      } catch {
        return false; // a cache that cannot be written never fails the sweep
      }
    },
  };
}

// --- HTTP ---------------------------------------------------------------------------

/**
 * One request with a timeout and a single retry on a network error or a 5xx.
 * Never throws: failures come back as `{ ok: false, error }` with a fixed code.
 */
export async function request(
  deps,
  url,
  { method = 'GET', headers = {}, body, timeoutMs = 30000, retries = 1 } = {}
) {
  let last = { ok: false, status: 0, error: 'network_error' };
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await deps.fetchImpl(url, {
        method,
        headers: { 'User-Agent': 'davintrade-security-pipeline', ...headers },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status >= 500 && attempt < retries) {
        last = {
          ok: false,
          status: response.status,
          error: `http_${response.status}`,
        };
        await deps.sleep?.(500);
        continue;
      }
      return {
        ok: response.ok,
        status: response.status,
        headers: response.headers,
        response,
        error: response.ok ? null : `http_${response.status}`,
      };
    } catch (error) {
      last = {
        ok: false,
        status: 0,
        error: error?.name === 'TimeoutError' ? 'timeout' : 'network_error',
      };
      if (attempt < retries) await deps.sleep?.(500);
    }
  }
  return last;
}

async function readJson(result) {
  try {
    return { ok: true, data: JSON.parse(await result.response.text()) };
  } catch {
    return { ok: false, error: 'invalid_json' };
  }
}

// --- conditional feeds (KEV, Node index) ----------------------------------------------

/**
 * Fetches a JSON feed with a conditional GET (ETag or Last-Modified) and reduces
 * it to what the engine needs. Falls back to the cached copy when the network
 * fails, and reports how fresh the data is.
 *
 * @returns {Promise<{ status: 'fresh' | 'not_modified' | 'cache_fresh' | 'cache_offline' | 'stale_cache' | 'unavailable', data: unknown, detail: string | null }>}
 */
export async function fetchFeed({
  deps,
  url,
  cacheName,
  reduce,
  ttlMs = 6 * HOUR,
  offline = false,
  refresh = false,
}) {
  const now = deps.now().getTime();
  const cached = deps.cache.read(cacheName);
  const usable =
    cached && typeof cached === 'object' && cached.data !== undefined;
  if (offline) {
    return usable
      ? { status: 'cache_offline', data: cached.data, detail: null }
      : { status: 'unavailable', data: null, detail: 'offline_no_cache' };
  }
  if (usable && !refresh && now - Date.parse(cached.fetchedAt) < ttlMs) {
    return { status: 'cache_fresh', data: cached.data, detail: null };
  }
  const headers = {};
  if (usable && cached.etag) headers['If-None-Match'] = cached.etag;
  else if (usable && cached.lastModified)
    headers['If-Modified-Since'] = cached.lastModified;
  const result = await request(deps, url, { headers });
  const fallback = (detail) =>
    usable
      ? { status: 'stale_cache', data: cached.data, detail }
      : { status: 'unavailable', data: null, detail };

  if (result.status === 304 && usable) {
    deps.cache.write(cacheName, {
      ...cached,
      fetchedAt: deps.now().toISOString(),
    });
    return { status: 'not_modified', data: cached.data, detail: null };
  }
  if (!result.ok) return fallback(result.error);
  const parsed = await readJson(result);
  if (!parsed.ok) return fallback(parsed.error);
  let data;
  try {
    data = reduce(parsed.data);
  } catch {
    return fallback('unexpected_shape');
  }
  if (data === null || data === undefined) return fallback('unexpected_shape');
  deps.cache.write(cacheName, {
    etag: result.headers?.get?.('etag') ?? null,
    lastModified: result.headers?.get?.('last-modified') ?? null,
    fetchedAt: deps.now().toISOString(),
    data,
  });
  return { status: 'fresh', data, detail: null };
}

/** The CISA KEV catalog reduced to its CVE identifiers. */
export function reduceKev(json) {
  if (!json || !Array.isArray(json.vulnerabilities)) return null;
  const cves = json.vulnerabilities
    .map((v) => String(v?.cveID ?? '').toUpperCase())
    .filter((id) => /^CVE-\d{4}-\d{4,}$/.test(id));
  if (cves.length === 0) return null;
  return {
    catalogVersion:
      typeof json.catalogVersion === 'string' ? json.catalogVersion : null,
    count: cves.length,
    cves: unique(cves).sort(),
  };
}

export const fetchKev = (args) =>
  fetchFeed({ ...args, url: URLS.kev, cacheName: 'kev', reduce: reduceKev });

/** The Node.js release index reduced to the newest and newest security release per line. */
export const fetchNodeFeed = (args) =>
  fetchFeed({
    ...args,
    url: URLS.nodeIndex,
    cacheName: 'node-index',
    reduce: (json) =>
      Array.isArray(json) && json.length > 0 ? reduceNodeIndex(json) : null,
  });

// --- EPSS --------------------------------------------------------------------------------

const EPSS_BATCH = 80;

/**
 * EPSS scores for a list of CVEs (batched; cached for the UTC day). A CVE with
 * no score is cached as null so it is not asked for again the same day.
 *
 * @returns {Promise<{ status: string, scores: Map<string, { score: number, percentile: number | null }>, detail: string | null }>}
 */
export async function fetchEpss({ deps, cves, offline = false }) {
  const today = deps.now().toISOString().slice(0, 10);
  const stored = deps.cache.read('epss');
  const entries =
    stored?.date === today &&
    stored.entries &&
    typeof stored.entries === 'object'
      ? { ...stored.entries }
      : {};
  const wanted = unique(
    cves.map((c) => c.toUpperCase()).filter((c) => /^CVE-\d{4}-\d{4,}$/.test(c))
  );
  const missing = wanted.filter((c) => !(c in entries));
  if (wanted.length === 0)
    return { status: 'no_cves', scores: new Map(), detail: null };
  let status =
    missing.length === 0
      ? offline
        ? 'cache_offline'
        : 'cache_fresh'
      : 'fresh';
  let detail = null;
  if (missing.length > 0 && offline) {
    status = Object.keys(entries).length > 0 ? 'cache_offline' : 'unavailable';
    detail = 'offline';
  } else {
    for (let i = 0; i < missing.length; i += EPSS_BATCH) {
      const batch = missing.slice(i, i + EPSS_BATCH);
      const result = await request(deps, `${URLS.epss}?cve=${batch.join(',')}`);
      const parsed = result.ok
        ? await readJson(result)
        : { ok: false, error: result.error };
      if (!parsed.ok || !Array.isArray(parsed.data?.data)) {
        status =
          Object.keys(entries).length > 0 ? 'stale_cache' : 'unavailable';
        detail = parsed.error ?? 'unexpected_shape';
        break;
      }
      for (const cve of batch) entries[cve] = null;
      for (const row of parsed.data.data) {
        const cve = String(row?.cve ?? '').toUpperCase();
        const score = Number(row?.epss);
        const percentile = Number(row?.percentile);
        if (!(cve in entries) || !(score >= 0 && score <= 1)) continue;
        entries[cve] = {
          score,
          percentile: percentile >= 0 && percentile <= 1 ? percentile : null,
        };
      }
    }
  }
  if (missing.length > 0 && status === 'fresh')
    deps.cache.write('epss', { date: today, entries });
  const scores = new Map();
  for (const cve of wanted) if (entries[cve]) scores.set(cve, entries[cve]);
  return { status, scores, detail };
}

// --- OSV ----------------------------------------------------------------------------------

const OSV_BATCH = 1000;
const OSV_PAGES = 5;

/**
 * Asks OSV which advisories affect each `{ ecosystem, name, version }`. The
 * answer lists identifiers only; records are fetched separately.
 *
 * @returns {Promise<{ status: 'ok' | 'unavailable' | 'skipped_offline', results: Array<Array<{ id: string }>> | null, detail: string | null }>}
 */
export async function osvQueryBatch({ deps, queries, offline = false }) {
  if (offline)
    return { status: 'skipped_offline', results: null, detail: null };
  const results = queries.map(() => []);
  for (let start = 0; start < queries.length; start += OSV_BATCH) {
    let pending = queries
      .slice(start, start + OSV_BATCH)
      .map((q, i) => ({ index: start + i, q, token: null }));
    for (let page = 0; page < OSV_PAGES && pending.length > 0; page += 1) {
      const body = JSON.stringify({
        queries: pending.map(({ q, token }) => ({
          package: { name: q.name, ecosystem: q.ecosystem },
          version: q.version,
          ...(token ? { page_token: token } : {}),
        })),
      });
      const response = await request(deps, `${URLS.osv}/v1/querybatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        timeoutMs: 60000,
      });
      const parsed = response.ok
        ? await readJson(response)
        : { ok: false, error: response.error };
      if (
        !parsed.ok ||
        !Array.isArray(parsed.data?.results) ||
        parsed.data.results.length !== pending.length
      ) {
        return {
          status: 'unavailable',
          results: null,
          detail: parsed.error ?? 'unexpected_shape',
        };
      }
      const next = [];
      parsed.data.results.forEach((row, i) => {
        for (const vuln of asArray(row?.vulns)) {
          if (typeof vuln?.id === 'string')
            results[pending[i].index].push({ id: vuln.id });
        }
        if (row?.next_page_token)
          next.push({ ...pending[i], token: row.next_page_token });
      });
      pending = next;
    }
  }
  return { status: 'ok', results, detail: null };
}

const isoDate = (value) =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;

// OSV events (`introduced`, `fixed`, `last_affected`) -> npm-style windows
function windows(events) {
  const out = [];
  let low = null;
  for (const event of asArray(events)) {
    if (typeof event?.introduced === 'string')
      low = event.introduced === '0' ? '0.0.0' : event.introduced;
    else if (typeof event?.fixed === 'string' && low !== null) {
      out.push({ range: `>=${low} <${event.fixed}`, fixed: event.fixed });
      low = null;
    } else if (typeof event?.last_affected === 'string' && low !== null) {
      out.push({ range: `>=${low} <=${event.last_affected}`, fixed: null });
      low = null;
    }
  }
  if (low !== null) out.push({ range: `>=${low}`, fixed: null });
  return out;
}

/**
 * Keeps what the engine needs from an OSV vulnerability record: identifiers,
 * withdrawal, severity, CWEs, summary and, per affected package, the vulnerable
 * windows and the versions that fix them.
 */
export function reduceOsvRecord(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string')
    return null;
  const vector =
    asArray(raw.severity)
      .map((s) => (typeof s?.score === 'string' ? s.score : null))
      .find((s) => s && /^CVSS:3\./.test(s)) ?? null;
  return {
    id: raw.id,
    modified: isoDate(raw.modified),
    withdrawn: isoDate(raw.withdrawn),
    aliases: unique(
      [...asArray(raw.aliases), ...asArray(raw.upstream)].filter(
        (a) => typeof a === 'string'
      )
    ),
    summary: String(raw.summary ?? '').slice(0, 300),
    severityLabel: normalizeSeverity(raw.database_specific?.severity),
    cvssVector: vector,
    cvss: vector ? cvss3Score(vector) : null,
    cwes: parseCwes(raw.database_specific?.cwe_ids ?? []),
    affected: asArray(raw.affected)
      .filter((a) => typeof a?.package?.name === 'string')
      .map((a) => ({
        ecosystem: String(a.package.ecosystem ?? ''),
        name: a.package.name,
        windows: asArray(a.ranges).flatMap((r) => windows(r?.events)),
        versions: asArray(a.versions).slice(0, 400).map(String),
      })),
  };
}

/**
 * Fetches OSV records by identifier, with a 24 h cache. A record that does not
 * exist (404) is cached as null.
 *
 * @returns {Promise<{ status: string, records: Map<string, object | null>, failed: number, detail: string | null }>}
 */
export async function osvGetVulns({
  deps,
  ids,
  offline = false,
  ttlMs = 24 * HOUR,
  concurrency = 6,
}) {
  const wanted = unique(ids);
  const cacheName = 'osv-vulns';
  const stored = deps.cache.read(cacheName);
  const entries =
    stored &&
    typeof stored === 'object' &&
    stored.entries &&
    typeof stored.entries === 'object'
      ? { ...stored.entries }
      : {};
  const now = deps.now().getTime();
  const records = new Map();
  const todo = [];
  for (const id of wanted) {
    const hit = entries[id];
    if (hit && (offline || now - Date.parse(hit.fetchedAt) < ttlMs))
      records.set(id, hit.record ?? null);
    else todo.push(id);
  }
  let failed = 0;
  if (!offline) {
    let cursor = 0;
    const worker = async () => {
      while (cursor < todo.length) {
        const id = todo[cursor];
        cursor += 1;
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
          failed += 1;
          continue;
        }
        const result = await request(
          deps,
          `${URLS.osv}/v1/vulns/${encodeURIComponent(id)}`
        );
        if (result.status === 404) {
          entries[id] = { fetchedAt: deps.now().toISOString(), record: null };
          records.set(id, null);
          continue;
        }
        const parsed = result.ok ? await readJson(result) : { ok: false };
        const record = parsed.ok ? reduceOsvRecord(parsed.data) : null;
        if (!record) {
          failed += 1;
          if (entries[id]) records.set(id, entries[id].record ?? null); // stale beats nothing
          continue;
        }
        entries[id] = { fetchedAt: deps.now().toISOString(), record };
        records.set(id, record);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(concurrency, todo.length) }, worker)
    );
    if (todo.length > 0) deps.cache.write(cacheName, { entries });
  } else {
    for (const id of todo) failed += 1;
  }
  const status = offline
    ? 'cache_offline'
    : failed === 0
      ? 'ok'
      : failed === todo.length && todo.length > 0
        ? 'unavailable'
        : 'partial';
  return {
    status,
    records,
    failed,
    detail: failed > 0 ? `${failed}_of_${wanted.length}_unavailable` : null,
  };
}

// --- OSV records -> findings ----------------------------------------------------------------

/** Groups OSV records that alias each other (a GHSA and its CVE and PYSEC twins). */
export function groupByAlias(records) {
  const parent = new Map();
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const union = (a, b) => {
    for (const x of [a, b]) if (!parent.has(x)) parent.set(x, x);
    parent.set(find(a), find(b));
  };
  for (const r of records) {
    union(r.id, r.id);
    for (const alias of r.aliases) union(r.id, alias);
  }
  const groups = new Map();
  for (const r of records) {
    const root = find(r.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(r);
  }
  return [...groups.values()];
}

const idRank = (id) =>
  /^GHSA-/i.test(id)
    ? 0
    : /^CVE-/i.test(id)
      ? 1
      : /^PYSEC-/i.test(id)
        ? 2
        : /^MAL-/i.test(id)
          ? 3
          : 4;

/** Severity of a group of records: the highest stated, else assumed `moderate`. */
function groupSeverity(group) {
  let best = null;
  for (const r of group) {
    const s = r.severityLabel ?? severityFromScore(r.cvss);
    if (s && (best === null || severityRank(s) > severityRank(best))) best = s;
  }
  return best;
}

/** Versions in the records that fix the package, above the installed one. */
function fixesFor(group, { name, ecosystem, version }) {
  const fixes = [];
  let known = false;
  for (const r of group) {
    for (const a of r.affected) {
      if (
        a.name.toLowerCase() !== name.toLowerCase() ||
        a.ecosystem !== ecosystem
      )
        continue;
      known = true;
      for (const w of a.windows) {
        if (
          w.fixed &&
          parseVersion(w.fixed) &&
          (version === null || compareVersions(w.fixed, version) === 1)
        )
          fixes.push(w.fixed);
      }
    }
  }
  return { fixes: unique(fixes), known };
}

/**
 * Findings for one pinned Python package, from the OSV records that affect it.
 * Records that alias each other are one finding.
 */
export function pipFindingsFromOsv({ assetId, pkg, records, scope }) {
  const out = [];
  for (const group of groupByAlias(records)) {
    const ids = unique(group.flatMap((r) => [r.id, ...r.aliases])).sort(
      (a, b) => idRank(a) - idRank(b)
    );
    const severity = groupSeverity(group);
    const best = group.reduce(
      (a, r) => ((r.cvss ?? -1) > (a?.cvss ?? -1) ? r : a),
      null
    );
    const { fixes, known } = fixesFor(group, {
      name: pkg.name,
      ecosystem: 'PyPI',
      version: pkg.version,
    });
    out.push(
      makeFinding({
        source: 'osv',
        ecosystem: 'pip',
        assetId,
        packageName: pkg.name,
        version: pkg.version,
        advisoryIds: ids,
        primaryId: ids[0],
        title: group.map((r) => r.summary).find(Boolean) ?? '',
        severity: severity ?? 'moderate',
        severityAssumed: severity === null,
        cvss: best?.cvss ?? null,
        cvssVector: best?.cvssVector ?? null,
        cwes: unique(group.flatMap((r) => r.cwes)),
        fixedVersions: fixes,
        fixKnown: known,
        direct: true,
        // a package of a development-only manifest is dev_only; otherwise known test and
        // lint tools are, and everything else is runtime
        scope: scope ?? (isPipDevTool(pkg.name) ? 'dev_only' : 'runtime'),
        withdrawn: group.every((r) => r.withdrawn),
        malicious: ids.some((id) => /^MAL-/i.test(id)),
      })
    );
  }
  return out;
}

/** A finding for a package that OSV lists as malicious (`MAL-` record). */
export function maliciousFinding({ assetId, ecosystem, pkg, record }) {
  return makeFinding({
    source: 'osv',
    ecosystem,
    assetId,
    packageName: pkg.name,
    version: pkg.version,
    advisoryIds: unique([record.id, ...record.aliases]),
    primaryId: record.id,
    title: record.summary,
    severity: 'critical',
    vulnClass: 'rce',
    direct: false,
    scope: 'runtime',
    malicious: true,
    withdrawn: Boolean(record.withdrawn),
    fixedVersions: [],
    fixKnown: false,
  });
}

/**
 * Findings for `pnpm.auditConfig.ignoreGhsas`: advisories pnpm mutes, so the
 * audit never lists them. Each is resolved to the lockfile packages it affects.
 *
 * @param {{ ids: string[], records: Map<string, object | null>, lockKeys: Set<string>, assetId: string, directNames?: Set<string> }} input
 * @returns {{ findings: object[], entries: { id: string, matched: number, withdrawn: boolean, record: boolean }[] }}
 */
export function acceptedIgnoreFindings({
  ids,
  records,
  lockKeys,
  assetId,
  directNames = new Set(),
}) {
  const findings = [];
  const entries = [];
  const installed = new Map();
  for (const key of lockKeys) {
    const at = key.lastIndexOf('@');
    if (at <= 0) continue;
    const name = key.slice(0, at);
    if (!installed.has(name)) installed.set(name, []);
    installed.get(name).push(key.slice(at + 1));
  }
  for (const id of ids) {
    const record = records.get(id) ?? null;
    let matched = 0;
    if (record) {
      for (const a of record.affected.filter((x) => x.ecosystem === 'npm')) {
        for (const version of installed.get(a.name) ?? []) {
          const hit =
            a.windows.some((w) => inWindow(version, w.range)) ||
            a.versions.includes(version);
          if (!hit) continue;
          matched += 1;
          const severity =
            record.severityLabel ?? severityFromScore(record.cvss);
          const fixes = unique(
            a.windows
              .map((w) => w.fixed)
              .filter(
                (f) => f && parseVersion(f) && compareVersions(f, version) === 1
              )
          );
          findings.push(
            makeFinding({
              source: 'pnpm-ignore',
              ecosystem: 'npm',
              assetId,
              packageName: a.name,
              version,
              advisoryIds: unique([record.id, ...record.aliases]),
              primaryId: record.id,
              title: record.summary,
              severity: severity ?? 'moderate',
              severityAssumed: severity === null,
              cvss: record.cvss,
              cvssVector: record.cvssVector,
              cwes: record.cwes,
              fixedVersions: fixes,
              fixKnown: true,
              direct: directNames.has(a.name),
              acceptedIgnore: true,
              withdrawn: Boolean(record.withdrawn),
            })
          );
        }
      }
    }
    entries.push({
      id,
      matched,
      withdrawn: Boolean(record?.withdrawn),
      record: record !== null,
    });
  }
  return { findings, entries };
}

function inWindow(version, range) {
  // windows are `>=A <B`, `>=A <=B` or `>=A`
  const m = /^>=(\S+)(?: (<=?)(\S+))?$/.exec(range);
  if (!m || !parseVersion(version) || !parseVersion(m[1])) return false;
  if (compareVersions(version, m[1]) === -1) return false;
  if (!m[2]) return true;
  const order = compareVersions(version, m[3]);
  return m[2] === '<' ? order === -1 : order !== 1 && order !== null;
}

/**
 * Adds what the feeds know to a finding: aliases, withdrawal, malicious flag,
 * KEV, EPSS, and the fix versions and CWEs of its OSV record when the matcher
 * had none.
 *
 * @param {object} finding
 * @param {{ records: Map<string, object | null>, kev: Set<string> | null, epss: Map<string, { score: number, percentile: number | null }> }} intel
 */
export function enrichFinding(finding, { records, kev, epss }) {
  const f = { ...finding };
  const own = f.advisoryIds.map((id) => records.get(id)).filter(Boolean);
  const aliases = unique([
    ...f.advisoryIds,
    ...own.flatMap((r) => [r.id, ...r.aliases]),
  ]);
  f.advisoryIds = aliases.sort((a, b) => idRank(a) - idRank(b));
  const primary = records.get(f.primaryId);
  if (primary?.withdrawn) f.withdrawn = true;
  if (aliases.some((id) => /^MAL-/i.test(id)) && !primary?.withdrawn)
    f.malicious = true;
  const cves = aliases
    .filter((id) => /^CVE-/i.test(id))
    .map((id) => id.toUpperCase());
  f.cves = cves;
  f.inKev = kev ? cves.some((id) => kev.has(id)) : false;
  let top = null;
  for (const cve of cves) {
    const e = epss.get(cve);
    if (e && (top === null || e.score > top.score)) top = e;
  }
  f.epssScore = top ? top.score : null;
  f.epssPercentile = top ? top.percentile : null;
  if (f.cwes.length === 0) {
    f.cwes = unique(own.flatMap((r) => r.cwes));
    if (f.cwes.length > 0 && f.vulnClass === 'other') {
      f.vulnClass = classifyVulnerability({
        cwes: f.cwes,
        title: f.title,
        vector: f.cvssVector ?? '',
      });
    }
  }
  if (f.fixedVersions.length === 0 && f.kind === 'advisory' && f.version) {
    const { fixes, known } = fixesFor(own, {
      name: f.packageName,
      ecosystem: f.ecosystem === 'pip' ? 'PyPI' : 'npm',
      version: f.version,
    });
    if (fixes.length > 0) f.fixedVersions = fixes;
    if (known) f.fixKnown = true;
  }
  return f;
}

// --- Dependabot --------------------------------------------------------------------------------

/**
 * Reads the open Dependabot alerts of a repository (all pages) and keeps the
 * fields the reconciliation needs. The token is sent to the API origin only.
 *
 * @returns {Promise<{ status: string, alerts: object[], detail: string | null }>}
 */
export async function readDependabotAlerts({
  deps,
  token,
  repo = DEFAULT_REPO,
  apiBase = DEFAULT_API_BASE,
  maxPages = 30,
}) {
  let url = `${apiBase}/repos/${repo}/dependabot/alerts?state=open&per_page=100`;
  const alerts = [];
  for (let page = 0; url && page < maxPages; page += 1) {
    const result = await request(deps, url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!result.ok) {
      const limit = rateLimitState(result.status, result.headers);
      return {
        status: 'unavailable',
        alerts,
        detail: limit.reason === 'rate_limited' ? 'rate_limited' : result.error,
      };
    }
    const parsed = await readJson(result);
    if (!parsed.ok || !Array.isArray(parsed.data))
      return {
        status: 'unavailable',
        alerts,
        detail: parsed.error ?? 'unexpected_shape',
      };
    for (const alert of parsed.data) {
      alerts.push({
        number: Number.isInteger(alert?.number) ? alert.number : null,
        ghsa:
          typeof alert?.security_advisory?.ghsa_id === 'string'
            ? alert.security_advisory.ghsa_id
            : null,
        cve:
          typeof alert?.security_advisory?.cve_id === 'string'
            ? alert.security_advisory.cve_id
            : null,
        packageName: String(alert?.dependency?.package?.name ?? ''),
        ecosystem: String(alert?.dependency?.package?.ecosystem ?? ''),
        manifestPath: String(alert?.dependency?.manifest_path ?? ''),
        scope:
          typeof alert?.dependency?.scope === 'string'
            ? alert.dependency.scope
            : null,
        severity: normalizeSeverity(alert?.security_advisory?.severity),
      });
    }
    const next = parseNextLink(result.headers?.get?.('link'));
    if (next && !isSameOrigin(next, apiBase))
      return { status: 'unavailable', alerts, detail: 'next_link_off_origin' };
    url = next;
  }
  return {
    status: url ? 'truncated' : 'ok',
    alerts,
    detail: url ? 'max_pages' : null,
  };
}

/**
 * Picks the GitHub token: DEPENDABOT_TRIAGE_TOKEN, then GITHUB_TOKEN, then the
 * credential Git holds for github.com (`git credential fill`, in memory only).
 *
 * @param {{ secrets: { dependabotToken?: string | null, githubToken?: string | null }, credentialFill: () => string | null }} input
 * @returns {{ token: string | null, source: 'DEPENDABOT_TRIAGE_TOKEN' | 'GITHUB_TOKEN' | 'git-credential' | null }}
 */
export function resolveGithubToken({ secrets, credentialFill }) {
  if (secrets.dependabotToken)
    return {
      token: secrets.dependabotToken,
      source: 'DEPENDABOT_TRIAGE_TOKEN',
    };
  if (secrets.githubToken)
    return { token: secrets.githubToken, source: 'GITHUB_TOKEN' };
  let output = null;
  try {
    output = credentialFill();
  } catch {
    output = null;
  }
  const password = parseGitCredential(output).password;
  return password
    ? { token: password, source: 'git-credential' }
    : { token: null, source: null };
}

/** Reads the `key=value` lines `git credential fill` prints. */
export function parseGitCredential(text) {
  const out = {};
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const eq = line.indexOf('=');
    if (eq > 0) out[line.slice(0, eq)] = line.slice(eq + 1);
  }
  return out;
}
