// One standalone run of the live posture sweep: arguments, the inventory and the runtime
// state, the probes, the private reports and the counts-only console summary.
//
// Everything with a side effect is injected (`deps`): the file system, the probe factory, the
// clock, the credential helper and the console. The CLI (run-posture-sweep.mjs) wires the real
// ones; the tests wire fakes. The repository is public, so stdout carries counts only; the
// hosts and settings go to the gitignored reports.

import { join } from 'node:path';
import { findPrivacyViolations, resolveSecrets } from './line-notifier-lib.mjs';
import {
  POSTURE_USAGE,
  PostureUsageError,
  parsePostureArgs,
  renderPostureSweepMarkdown,
  renderPostureSweepStdout,
  runPostureSweep,
} from './posture-sweep-lib.mjs';
import { resolveGithubToken } from './security-pipeline-intel.mjs';
import { PolicyError, loadInventory } from './security-pipeline-lib.mjs';

const safeLog = (log) => (line) =>
  log(
    findPrivacyViolations(line).length > 0
      ? '[line withheld by the privacy guard]'
      : line
  );

/**
 * Runs one sweep and returns the exit code (0 done, 1 unexpected failure, 2 usage or setup
 * error).
 *
 * @param {{
 *   argv: string[],
 *   env: Record<string, string | undefined>,
 *   deps: {
 *     root: string,
 *     fs: { readText: (p: string) => string | null, writeText: (p: string, t: string) => void, mkdirp: (p: string) => void },
 *     createProbes: (input: { root: string, token: string | null, repo: string }) => object,
 *     now: () => Date,
 *     log: (line: string) => void,
 *     credentialFill?: () => string | null,
 *   },
 * }} input
 */
export async function runPostureCli({ argv, env, deps }) {
  let options;
  try {
    options = parsePostureArgs(argv);
  } catch (error) {
    if (!(error instanceof PostureUsageError)) throw error;
    deps.log(`error=usage (${error.message})`);
    deps.log(POSTURE_USAGE);
    return 2;
  }
  if (options.help) {
    deps.log(POSTURE_USAGE);
    return 0;
  }
  const out = safeLog(deps.log);
  try {
    return await sweepOnce({ options, env, deps, out });
  } catch (error) {
    if (error instanceof PolicyError) {
      out(`error=${error.message}`);
      return 2;
    }
    out('error=unexpected_failure');
    return 1;
  }
}

async function sweepOnce({ options, env, deps, out }) {
  const fs = deps.fs;
  const root = options.root ?? deps.root;
  const pipelineDir =
    options.pipelineDir ??
    join(root, 'davintrade-security-monitoring-pipeline');
  const reportsDir = join(pipelineDir, 'reports');
  const paths = {
    inventory: join(root, 'security', 'security-inventory.yaml'),
    runtimeState: join(reportsDir, 'runtime-state.json'),
    json: join(reportsDir, 'latest-posture-sweep.json'),
    markdown: join(reportsDir, 'latest-posture-sweep.md'),
  };

  const inventoryText = fs.readText(paths.inventory);
  if (inventoryText === null) throw new PolicyError('inventory_not_found');
  const inventory = loadInventory(inventoryText);
  if (
    options.assets &&
    options.assets.some((id) => !inventory.assets.some((a) => a.id === id))
  ) {
    throw new PolicyError('unknown_asset');
  }

  let runtimeState = null;
  let stateUnreadable = false;
  const stateText = fs.readText(paths.runtimeState);
  if (stateText !== null) {
    try {
      runtimeState = JSON.parse(stateText);
    } catch {
      stateUnreadable = true;
    }
  }

  // the GitHub token: only an online run needs one (never printed, never stored)
  let token = null;
  if (!options.offline) {
    const secrets = resolveSecrets({
      env,
      fileText: fs.readText(options.secretsFile ?? join(root, '.env.local')),
    });
    token = resolveGithubToken({
      secrets,
      credentialFill: deps.credentialFill ?? (() => null),
    }).token;
  }

  const result = await runPostureSweep({
    inventory,
    runtimeState,
    probes: deps.createProbes({ root, token, repo: options.repo }),
    now: deps.now(),
    offline: options.offline,
    repo: options.repo,
    mainRef: options.mainRef,
    fetchMain: !options.noFetch,
    assetIds: options.assets,
  });
  if (stateUnreadable) {
    result.notes.push('runtime-state.json is not valid JSON and was ignored');
  }

  try {
    fs.mkdirp(reportsDir);
    fs.writeText(paths.json, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeText(paths.markdown, renderPostureSweepMarkdown(result));
  } catch {
    out('error=report_write_failed');
    return 1;
  }

  for (const line of renderPostureSweepStdout(result)) out(line);
  out(
    'reports: latest-posture-sweep.json and .md written (private, gitignored)'
  );
  return 0;
}
