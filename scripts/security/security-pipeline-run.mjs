// One sweep of the private security pipeline (Phase 2 of the security monitoring
// architecture, v3.0): policy -> matchers -> feeds -> scoring -> private reports
// -> LINE notification.
//
// Everything with a side effect is injected (`deps`): the file system, running
// `pnpm` and `npm`, `fetch`, the clock and the console. The CLI wires the real
// ones; the tests wire fakes. The repository is public, so stdout carries counts
// only; advisory identifiers and package names go to the gitignored reports.

import { dirname, join } from 'node:path';
import { lockfilePackageKeys, parseAuditJson } from './audit-diff-gate-lib.mjs';
import { DEFAULT_REPO } from './dependabot-triage-lib.mjs';
import {
  acceptedIgnoreFindings,
  createJsonCache,
  enrichFinding,
  fetchEpss,
  fetchKev,
  fetchNodeFeed,
  maliciousFinding,
  osvGetVulns,
  osvQueryBatch,
  pipFindingsFromOsv,
  readDependabotAlerts,
  resolveGithubToken,
} from './security-pipeline-intel.mjs';
import {
  PolicyError,
  buildNpmGraph,
  compareFindings,
  evaluateRuntimeFloors,
  isExcludedPath,
  loadInventory,
  mergeVexRegistries,
  npmFindings,
  parseNpmAuditJson,
  parseRequirements,
  pnpmFindings,
  pnpmGateParityCounts,
  reconcileDependabot,
  renderPostureMarkdown,
  renderStdoutSummary,
  scoreFinding,
  staleVexStatements,
  summarizeFindings,
  vexExpiryReasons,
  vexStatementMatches,
} from './security-pipeline-lib.mjs';
import {
  findPrivacyViolations,
  normalizeAlertState,
  renderPreview,
  resolveSecrets,
  runNotifications,
} from './line-notifier-lib.mjs';
import { parseVersion } from './security-semver-lite.mjs';

export class UsageError extends Error {}

export const USAGE = [
  'Usage: node scripts/security/run-security-pipeline.mjs [options]',
  '  --dry-run-line       build the LINE messages, write reports/last-line-message-preview.txt, send nothing',
  '  --notify-line        send LINE alerts on state transitions (and the daily heartbeat when due)',
  '  --heartbeat          with --notify-line / --dry-run-line: send the heartbeat unless one went out in the last 20 h',
  '  --with-dependabot    also read the open Dependabot alerts and reconcile them with the local matchers',
  '  --offline            no network: cached feeds only, the audit tools are not run',
  '  --refresh            ignore the feed cache lifetime (conditional requests are still used)',
  '  --assets a,b         only these inventory asset ids',
  '  --repo owner/name    repository for the Dependabot alerts (default ' +
    DEFAULT_REPO +
    ')',
  '  --root <dir>         repository root (default: the checkout this script is in)',
  '  --pipeline-dir <dir> private folder (default: <root>/davintrade-security-monitoring-pipeline)',
  '  --secrets-file <f>   file with the LINE secrets (default: <root>/.env.local; only 3 keys are read)',
  'Output: counts only on stdout; details in <pipeline-dir>/reports/ (gitignored).',
  'Exit codes: 0 done, 1 unexpected failure, 2 usage or setup error, 3 the LINE push failed.',
].join('\n');

const FLAGS = {
  '--notify-line': 'notifyLine',
  '--heartbeat': 'heartbeat',
  '--dry-run-line': 'dryRunLine',
  '--with-dependabot': 'withDependabot',
  '--offline': 'offline',
  '--refresh': 'refresh',
  '--help': 'help',
  '-h': 'help',
};
const VALUES = {
  '--root': 'root',
  '--pipeline-dir': 'pipelineDir',
  '--secrets-file': 'secretsFile',
  '--assets': 'assets',
  '--repo': 'repo',
};

/** @param {string[]} argv arguments after the script name */
export function parseArgs(argv) {
  const options = {
    notifyLine: false,
    heartbeat: false,
    dryRunLine: false,
    withDependabot: false,
    offline: false,
    refresh: false,
    help: false,
    root: null,
    pipelineDir: null,
    secretsFile: null,
    assets: null,
    repo: DEFAULT_REPO,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const inline = eq === -1 ? undefined : arg.slice(eq + 1);
    if (FLAGS[flag] && inline === undefined) {
      options[FLAGS[flag]] = true;
    } else if (VALUES[flag]) {
      const value = inline ?? argv[(i += 1)];
      if (value === undefined || value === '') {
        throw new UsageError(`${flag} needs a value`);
      }
      options[VALUES[flag]] = value;
    } else {
      throw new UsageError('unknown argument');
    }
  }
  if (options.assets !== null) {
    options.assets = options.assets
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (
      options.assets.length === 0 ||
      options.assets.some((id) => !/^[a-z0-9][a-z0-9-]*$/.test(id))
    ) {
      throw new UsageError('--assets must be a list of asset ids');
    }
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(options.repo)) {
    throw new UsageError('--repo must look like owner/name');
  }
  return options;
}

const PNPM_AUDIT = ['audit', '--prod', '--json', '--ignore-registry-errors'];
const NPM_AUDIT = ['audit', '--package-lock-only', '--omit=dev', '--json'];
const FEED_PROBLEMS = new Set([
  'unavailable',
  'partial',
  'stale_cache',
  'skipped_offline',
  'cache_offline',
]);
const unique = (items) => [...new Set(items)];

// `qs@<6.16.0`, `@scope/pkg@1`, `parent>child` -> the package the override names
function overrideTarget(key) {
  const last = String(key).split('>').pop();
  const m = /^(@[^/@]+\/[^@]+|[^@]+)(?:@.*)?$/.exec(last);
  return m ? m[1] : last;
}

const safeLog = (log) => (line) =>
  log(
    findPrivacyViolations(line).length > 0
      ? '[line withheld by the privacy guard]'
      : line
  );

/**
 * Runs one sweep and returns the exit code.
 *
 * @param {{
 *   argv: string[],
 *   env: Record<string, string | undefined>,
 *   deps: {
 *     root: string,
 *     fs: { readText: (p: string) => string | null, writeText: (p: string, t: string) => void, appendText: (p: string, t: string) => void, mkdirp: (p: string) => void },
 *     runCommand: (command: string, args: string[], options: { cwd: string, timeoutMs?: number }) => { status: number | null, stdout: string },
 *     fetchImpl: typeof fetch,
 *     now: () => Date,
 *     sleep?: (ms: number) => Promise<void>,
 *     log: (line: string) => void,
 *     credentialFill?: () => string | null,
 *     nodeVersion?: string,
 *   },
 * }} input
 */
export async function runPipeline({ argv, env, deps }) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    deps.log(`error=usage (${error.message})`);
    deps.log(USAGE);
    return 2;
  }
  if (options.help) {
    deps.log(USAGE);
    return 0;
  }
  const out = safeLog(deps.log);
  try {
    return await sweep({ options, env, deps, out });
  } catch (error) {
    if (error instanceof PolicyError) {
      out(`error=${error.message}`);
      return 2;
    }
    out('error=unexpected_failure');
    return 1;
  }
}

async function sweep({ options, env, deps, out }) {
  const fs = deps.fs;
  const now = deps.now();
  const today = now.toISOString().slice(0, 10);
  const root = options.root ?? deps.root;
  const pipelineDir =
    options.pipelineDir ??
    join(root, 'davintrade-security-monitoring-pipeline');
  const reportsDir = join(pipelineDir, 'reports');
  const paths = {
    inventory: join(root, 'security', 'security-inventory.yaml'),
    publicVex: join(root, 'security', 'vex-registry.json'),
    privateVex: join(pipelineDir, 'private-vex.json'),
    rootPackage: join(root, 'package.json'),
    runtimeState: join(reportsDir, 'runtime-state.json'),
    posture: join(reportsDir, 'latest-security-posture.json'),
    postureMd: join(reportsDir, 'latest-security-posture.md'),
    alertState: join(reportsDir, 'alert-state.json'),
    preview: join(reportsDir, 'last-line-message-preview.txt'),
    history: join(reportsDir, 'sweep-history.jsonl'),
    cache: join(reportsDir, '.cache'),
  };
  const readJson = (path) => {
    const text = fs.readText(path);
    if (text === null) return { present: false, value: null, invalid: false };
    try {
      return { present: true, value: JSON.parse(text), invalid: false };
    } catch {
      return { present: true, value: null, invalid: true };
    }
  };
  const offline = options.offline;
  const intelDeps = {
    fetchImpl: deps.fetchImpl,
    now: deps.now,
    sleep: deps.sleep ?? (async () => {}),
    cache: createJsonCache({ dir: paths.cache, fs }),
  };

  // --- policy ---------------------------------------------------------------------------
  const inventoryText = fs.readText(paths.inventory);
  if (inventoryText === null) throw new PolicyError('inventory_not_found');
  const inventory = loadInventory(inventoryText);
  let selected = inventory.assets;
  if (options.assets) {
    if (
      options.assets.some((id) => !inventory.assets.some((a) => a.id === id))
    ) {
      throw new PolicyError('unknown_asset');
    }
    selected = inventory.assets.filter((a) => options.assets.includes(a.id));
  }
  const publicVex = readJson(paths.publicVex);
  const privateVex = readJson(paths.privateVex);
  const vex = mergeVexRegistries({
    publicRegistry: publicVex.value,
    privateRegistry: privateVex.value,
    assetIds: new Set(inventory.assets.map((a) => a.id)),
    today,
  });
  if (publicVex.invalid)
    vex.status.public = {
      present: true,
      valid: false,
      errors: ['invalid_json'],
      count: 0,
    };
  if (privateVex.invalid)
    vex.status.private = {
      present: true,
      valid: false,
      errors: ['invalid_json'],
      count: 0,
    };
  const rootPackage = readJson(paths.rootPackage).value ?? {};
  const overrideNames = new Set(
    [
      ...Object.keys(rootPackage?.pnpm?.overrides ?? {}),
      ...Object.keys(rootPackage?.overrides ?? {}),
    ].map(overrideTarget)
  );
  const ignoreIds = unique(
    (Array.isArray(rootPackage?.pnpm?.auditConfig?.ignoreGhsas)
      ? rootPackage.pnpm.auditConfig.ignoreGhsas
      : []
    )
      .filter(
        (id) =>
          typeof id === 'string' &&
          /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(id)
      )
      .map((id) => `GHSA-${id.slice(5).toLowerCase()}`)
  );
  const secrets = resolveSecrets({
    env,
    fileText: fs.readText(options.secretsFile ?? join(root, '.env.local')),
  });

  // --- matchers -----------------------------------------------------------------------------
  const st = {
    findings: [],
    items: [],
    pinning: [],
    notes: [],
    lockKeys: new Map(),
    packages: new Map(),
    pipItems: [],
    pnpm: null,
    parity: null,
    pnpmMeta: null,
  };
  const item = (assetId, type, status, detail = null) => {
    const entry = { id: `${assetId}:${type}`, assetId, status, detail };
    st.items.push(entry);
    return entry;
  };
  const addKeys = (assetId, keys) => {
    if (!st.lockKeys.has(assetId)) st.lockKeys.set(assetId, new Set());
    for (const key of keys) st.lockKeys.get(assetId).add(key);
  };
  const addPackage = (ecosystem, name, version, assetId) => {
    if (!parseVersion(version) && ecosystem === 'npm') return;
    const key = `${ecosystem}|${name}|${version}`;
    if (!st.packages.has(key))
      st.packages.set(key, { ecosystem, name, version, owners: new Set() });
    st.packages.get(key).owners.add(assetId);
  };
  const run = (command, args, cwd, timeoutMs) => {
    try {
      return deps.runCommand(command, args, { cwd, timeoutMs });
    } catch {
      return { status: 127, stdout: '' };
    }
  };

  for (const asset of selected) {
    for (const eco of asset.ecosystems) {
      const path = eco.lockfilePath ?? eco.manifestPath;
      if (eco.type !== 'pnpm' && eco.type !== 'npm' && eco.type !== 'pip') {
        item(asset.id, eco.type ?? 'unknown', 'skipped', 'not_in_phase_2');
        continue;
      }
      if (path && isExcludedPath(path, inventory.excludedPaths)) {
        item(asset.id, eco.type, 'skipped', 'excluded_path');
        continue;
      }
      if (eco.type === 'pnpm') {
        pnpmMatcher({ asset, eco });
      } else if (eco.type === 'npm') {
        npmMatcher({ asset, eco });
      } else {
        pipMatcher({ asset, eco });
      }
    }
  }

  function pnpmMatcher({ asset, eco }) {
    const lockText = eco.lockfilePath
      ? fs.readText(join(root, eco.lockfilePath))
      : null;
    if (lockText === null)
      return item(asset.id, 'pnpm', 'failed', 'missing_lockfile');
    const keys = lockfilePackageKeys(lockText);
    addKeys(asset.id, keys);
    for (const key of keys) {
      const at = key.lastIndexOf('@');
      if (at > 0)
        addPackage('npm', key.slice(0, at), key.slice(at + 1), asset.id);
    }
    const directNames = new Set();
    for (const importer of eco.workspaceImporters.length > 0
      ? eco.workspaceImporters
      : ['.']) {
      const pkg = readJson(join(root, importer, 'package.json')).value;
      for (const name of Object.keys({
        ...pkg?.dependencies,
        ...pkg?.optionalDependencies,
      }))
        directNames.add(name);
    }
    st.pnpm = { assetId: asset.id, directNames };
    if (offline) return item(asset.id, 'pnpm', 'skipped', 'offline');

    const version = run('pnpm', ['--version'], root, 60000);
    const pinned = inventory.toolchain.pnpmVersion;
    if (version.status === 0 && pinned && version.stdout.trim() !== pinned) {
      st.notes.push(
        `pnpm ${version.stdout.trim()} ran the audit; the inventory pins ${pinned}: results may differ from the blocking gate`
      );
    }
    const result = run('pnpm', PNPM_AUDIT, root, 240000);
    const parsed = parseAuditJson(result.stdout);
    if (parsed.kind !== 'ok') {
      return item(
        asset.id,
        'pnpm',
        'failed',
        parsed.kind === 'unavailable'
          ? 'registry_unavailable'
          : 'invalid_output'
      );
    }
    st.parity = pnpmGateParityCounts(parsed.advisories);
    try {
      st.pnpmMeta = JSON.parse(result.stdout).metadata?.vulnerabilities ?? null;
    } catch {
      st.pnpmMeta = null;
    }
    st.findings.push(
      ...pnpmFindings({
        advisories: parsed.advisories,
        assetId: asset.id,
        directNames,
        overrideNames,
        buildOnly: asset.buildOnlyPackages,
      })
    );
    return item(asset.id, 'pnpm', 'ok');
  }

  function npmMatcher({ asset, eco }) {
    const lock = eco.lockfilePath
      ? readJson(join(root, eco.lockfilePath)).value
      : null;
    const graph = buildNpmGraph(lock);
    if (!graph) return item(asset.id, 'npm', 'failed', 'unreadable_lockfile');
    addKeys(asset.id, graph.packageKeys());
    for (const node of graph.nodes.values())
      addPackage('npm', node.name, node.version, asset.id);
    if (offline) return item(asset.id, 'npm', 'skipped', 'offline');

    const cwd = join(root, dirname(eco.lockfilePath));
    const own = readJson(join(cwd, 'package.json')).value;
    const names = new Set(
      Object.keys(own?.overrides ?? {}).map(overrideTarget)
    );
    const result = run('npm', NPM_AUDIT, cwd, 240000);
    const parsed = parseNpmAuditJson(result.stdout);
    if (parsed.kind !== 'ok') {
      return item(
        asset.id,
        'npm',
        'failed',
        parsed.kind === 'unavailable'
          ? 'registry_unavailable'
          : 'invalid_output'
      );
    }
    st.findings.push(
      ...npmFindings({
        report: parsed.report,
        graph,
        assetId: asset.id,
        buildOnly: asset.buildOnlyPackages,
        overrideNames: names,
      })
    );
    return item(asset.id, 'npm', 'ok');
  }

  function pipMatcher({ asset, eco }) {
    const text = eco.manifestPath
      ? fs.readText(join(root, eco.manifestPath))
      : null;
    if (text === null)
      return item(asset.id, 'pip', 'failed', 'missing_manifest');
    const parsed = parseRequirements(text);
    st.pinning.push({
      assetId: asset.id,
      pinned: parsed.pinned.length,
      unpinned: parsed.unpinned.length,
      pinningRequired: eco.pinningRequired,
    });
    for (const p of parsed.pinned)
      addPackage('PyPI', p.name, p.version, asset.id);
    st.pipItems.push({
      assetId: asset.id,
      entry: item(asset.id, 'pip', 'pending'),
    });
    return null;
  }

  // --- OSV (malicious packages, withdrawals, Python, the muted advisories) ----------------------
  const packages = [...st.packages.values()];
  const batch = await osvQueryBatch({
    deps: intelDeps,
    queries: packages.map(({ ecosystem, name, version }) => ({
      ecosystem,
      name,
      version,
    })),
    offline,
  });
  const idsFor = (index) => {
    const ids = (batch.results?.[index] ?? []).map((v) => v.id);
    return packages[index].ecosystem === 'npm'
      ? ids.filter((id) => /^MAL-/i.test(id))
      : ids;
  };
  const wanted = new Set();
  packages.forEach((_, index) => idsFor(index).forEach((id) => wanted.add(id)));
  for (const f of st.findings) {
    for (const id of f.advisoryIds) if (/^GHSA-/i.test(id)) wanted.add(id);
  }
  for (const id of ignoreIds) wanted.add(id);
  const got = await osvGetVulns({ deps: intelDeps, ids: [...wanted], offline });
  const osvStatus = batch.status !== 'ok' ? batch.status : got.status;
  const osvDetail = batch.status !== 'ok' ? batch.detail : got.detail;

  for (const { entry } of st.pipItems) {
    if (offline) Object.assign(entry, { status: 'skipped', detail: 'offline' });
    else if (batch.status !== 'ok')
      Object.assign(entry, { status: 'failed', detail: 'osv_unavailable' });
    else entry.status = 'ok';
  }
  packages.forEach((pkg, index) => {
    const records = idsFor(index)
      .map((id) => got.records.get(id))
      .filter(Boolean);
    if (records.length === 0) return;
    for (const assetId of pkg.owners) {
      if (pkg.ecosystem === 'PyPI') {
        st.findings.push(
          ...pipFindingsFromOsv({
            assetId,
            pkg: { name: pkg.name, version: pkg.version },
            records,
          })
        );
      } else {
        for (const record of records.filter((r) => /^MAL-/i.test(r.id))) {
          st.findings.push(
            maliciousFinding({
              assetId,
              ecosystem: 'npm',
              pkg: { name: pkg.name, version: pkg.version },
              record,
            })
          );
        }
      }
    }
  });

  // the advisories pnpm mutes (pnpm.auditConfig.ignoreGhsas): re-read so a
  // withdrawal, a fix or a KEV listing resurfaces
  const ignored = st.pnpm
    ? acceptedIgnoreFindings({
        ids: ignoreIds,
        records: got.records,
        lockKeys: st.lockKeys.get(st.pnpm.assetId) ?? new Set(),
        assetId: st.pnpm.assetId,
        directNames: st.pnpm.directNames,
      })
    : { findings: [], entries: [] };
  st.findings.push(...ignored.findings);

  // --- KEV, EPSS, Node ------------------------------------------------------------------------------
  const kev = await fetchKev({
    deps: intelDeps,
    offline,
    refresh: options.refresh,
  });
  const kevSet = kev.data ? new Set(kev.data.cves) : null;
  const advisoryFindings = st.findings.filter((f) => f.kind === 'advisory');
  const first = advisoryFindings.map((f) =>
    enrichFinding(f, { records: got.records, kev: kevSet, epss: new Map() })
  );
  const epss = await fetchEpss({
    deps: intelDeps,
    cves: unique(first.flatMap((f) => f.cves)),
    offline,
  });
  const enriched = advisoryFindings.map((f) =>
    enrichFinding(f, { records: got.records, kev: kevSet, epss: epss.scores })
  );
  const nodeFeed = await fetchNodeFeed({
    deps: intelDeps,
    offline,
    refresh: options.refresh,
  });
  const runtimeState = readJson(paths.runtimeState).value;
  const floors = evaluateRuntimeFloors({
    inventory,
    nodeLines: nodeFeed.data,
    runtimeState:
      runtimeState && typeof runtimeState === 'object' ? runtimeState : null,
    runnerVersion: deps.nodeVersion ?? null,
  });
  const { findings: floorFindings, ...runtimeFloors } = floors;

  // --- scoring ---------------------------------------------------------------------------------------
  const byId = new Map(inventory.assets.map((a) => [a.id, a]));
  const policyAsset = {
    id: 'inventory',
    lifecycle: 'production',
    exposureTier: 1,
    escalationRequired: false,
    buildOnlyPackages: new Set(),
  };
  const context = {
    today,
    vexStatements: vex.statements,
    vexMatches: vexStatementMatches,
    vexExpiry: vexExpiryReasons,
  };
  const scored = [...enriched, ...floorFindings]
    .map((f) => scoreFinding(f, byId.get(f.assetId) ?? policyAsset, context))
    .sort(compareFindings);

  // --- Dependabot ---------------------------------------------------------------------------------------
  let dependabot = { status: 'skipped', detail: 'not_requested' };
  if (options.withDependabot) {
    if (offline) {
      dependabot = { status: 'skipped', detail: 'offline' };
    } else {
      const { token } = resolveGithubToken({
        secrets,
        credentialFill: deps.credentialFill ?? (() => null),
      });
      if (!token) {
        dependabot = { status: 'skipped', detail: 'no_token' };
      } else {
        const read = await readDependabotAlerts({
          deps: intelDeps,
          token,
          repo: options.repo,
        });
        dependabot =
          read.status === 'ok' || read.status === 'truncated'
            ? {
                ...reconcileDependabot({
                  alerts: read.alerts,
                  findings: scored,
                  inventory,
                }),
                detail: read.detail,
              }
            : { status: 'unavailable', detail: read.detail };
      }
    }
  }

  // --- posture --------------------------------------------------------------------------------------------
  const feeds = {
    osv: { status: osvStatus, detail: osvDetail },
    kev: { status: kev.status, detail: kev.detail },
    epss: { status: epss.status, detail: epss.detail },
    node_feed: { status: nodeFeed.status, detail: nodeFeed.detail },
    dependabot: {
      status: dependabot.status === 'compared' ? 'ok' : dependabot.status,
      detail: dependabot.detail ?? null,
    },
  };
  const counts = { ok: 0, failed: 0, skipped: 0 };
  for (const entry of st.items)
    if (entry.status in counts) counts[entry.status] += 1;
  const scannedAssets = new Set(
    st.items.filter((e) => e.status === 'ok').map((e) => e.assetId)
  );
  const degraded =
    offline ||
    counts.failed > 0 ||
    ['osv', 'kev', 'epss', 'node_feed'].some((name) =>
      FEED_PROBLEMS.has(feeds[name].status)
    ) ||
    (options.withDependabot && dependabot.status === 'unavailable');

  const accepted = ignored.entries.map((entry) => ({
    ...entry,
    inKev: ignored.findings.some(
      (f) =>
        f.advisoryIds.includes(entry.id) &&
        enriched.find((e) => e.key === f.key)?.inKev === true
    ),
    hasVex: vex.statements.some(
      (s) => s.advisory_id.toLowerCase() === entry.id.toLowerCase()
    ),
  }));
  if (ignoreIds.length > 0)
    st.notes.push(
      `${ignoreIds.length} advisory(ies) are muted by pnpm.auditConfig.ignoreGhsas; ${accepted.filter((a) => !a.hasVex).length} have no VEX statement`
    );
  if (floors.runner?.below_floor)
    st.notes.push(
      `The Node.js that ran this sweep (${floors.runner.version}) is below its line's floor`
    );
  const lockKeysFor = (assetId) => st.lockKeys.get(assetId) ?? null;

  const posture = {
    schema_version: '1.0',
    generated_at: now.toISOString(),
    run: {
      offline,
      with_dependabot: options.withDependabot,
      refresh: options.refresh,
      degraded,
      runner_node: deps.nodeVersion ?? null,
    },
    inventory: {
      schema_version: inventory.schemaVersion,
      updated_at: inventory.updatedAt,
      assets_total: selected.length,
      assets_scanned: scannedAssets.size,
      assets_skipped: selected.length - scannedAssets.size,
    },
    summary: summarizeFindings(scored),
    runtime_floors: runtimeFloors,
    findings: scored,
    accepted_ignores: accepted,
    dependabot,
    matchers: {
      ...counts,
      items: st.items.map(({ id, status, detail }) => ({ id, status, detail })),
    },
    feeds,
    pinning: st.pinning,
    parity: { pnpm_gate: st.parity, pnpm_metadata: st.pnpmMeta },
    vex: {
      public: vex.status.public,
      private: vex.status.private,
      stale: staleVexStatements(vex.statements, lockKeysFor).map((s) => ({
        advisory_id: s.advisory_id,
        asset_id: s.asset_id,
        package_spec: s.package_spec,
      })),
    },
    notes: st.notes,
  };

  // --- reports (private, gitignored) --------------------------------------------------------------------------
  try {
    fs.mkdirp(reportsDir);
    fs.writeText(paths.posture, `${JSON.stringify(posture, null, 2)}\n`);
    fs.writeText(paths.postureMd, renderPostureMarkdown(posture));
    fs.appendText(
      paths.history,
      `${JSON.stringify({ at: posture.generated_at, offline, degraded, tiers: posture.summary.tiers, total: posture.summary.total, matchers_failed: counts.failed })}\n`
    );
  } catch {
    out('error=report_write_failed');
    return 1;
  }

  // --- LINE -------------------------------------------------------------------------------------------------------
  const stored = readJson(paths.alertState);
  const { state, reset } = normalizeAlertState(
    stored.invalid ? 'unreadable' : stored.value
  );
  if (reset)
    posture.notes.push('alert-state.json was unreadable and was reset');
  // Package names that are not plain words are refused in a message as well; a
  // plain word (a package called "open") would collide with the fixed text, and
  // a message is built from numbers, tiers and asset ids only.
  const forbidden = unique(
    scored.flatMap((f) => [
      ...f.advisoryIds,
      f.primaryId,
      /[\d@/_.-]/.test(f.packageName) ? f.packageName : null,
    ])
  ).filter(Boolean);
  const line = await runNotifications({
    options: {
      notifyLine: options.notifyLine,
      heartbeat: options.heartbeat,
      dryRunLine: options.dryRunLine,
    },
    secrets,
    posture,
    state,
    now,
    fetchImpl: deps.fetchImpl,
    sleep: deps.sleep,
    forbidden,
  });
  try {
    if (line.mode === 'dry_run' || line.mode === 'preview_no_credentials') {
      fs.writeText(
        paths.preview,
        renderPreview({
          now,
          reason:
            line.mode === 'dry_run'
              ? 'dry run: --dry-run-line'
              : 'the LINE credentials are not configured',
          texts: line.previewTexts,
        })
      );
    }
    if (line.nextState)
      fs.writeText(
        paths.alertState,
        `${JSON.stringify(line.nextState, null, 2)}\n`
      );
  } catch {
    out('error=report_write_failed');
    return 1;
  }

  // --- stdout: counts only ----------------------------------------------------------------------------------------
  for (const text of renderStdoutSummary(posture)) out(text);
  const hb = line.heartbeat
    ? line.heartbeat.send
      ? 'due'
      : line.heartbeat.reason
    : 'n/a';
  const lineText = {
    off: 'line: off (use --notify-line to send, --dry-run-line to preview)',
    dry_run: `line: dry run, preview written (alerts=${line.alerts} heartbeat=${hb})`,
    preview_no_credentials: `line: credentials not configured, preview written (alerts=${line.alerts} heartbeat=${hb})`,
    nothing_to_send: `line: nothing to send (alerts=${line.alerts} heartbeat=${hb})`,
    sent: `line: sent (alerts=${line.alerts} heartbeat=${line.heartbeatSent ? 'yes' : 'no'})`,
    failed: `line: send failed (${line.code ?? 'error'})`,
  }[line.mode];
  out(lineText);
  if (line.violations.length > 0)
    out(`line: privacy_guard_triggered=${line.violations.length}`);
  out(
    'reports: latest-security-posture.json and .md written (private, gitignored)'
  );
  return line.mode === 'failed' ? 3 : 0;
}
