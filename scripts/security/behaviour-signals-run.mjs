// One run of the behaviour signals: the owner's private files, the probes, the saved queue
// samples, the private reports and the counts-only console summary.
//
// Everything with a side effect is injected (`deps`): the file system, the probe factory, the
// clock, the credential helper and the console. The CLI (run-behaviour-signals.mjs) wires the
// real ones; the tests wire fakes. `collectBehaviour` is shared with the full sweep
// (`run-security-pipeline.mjs --with-behaviour`). The repository is public, so stdout carries
// counts only; routes, buckets and commits go to the gitignored reports.
//
// Private files (all optional, all in the gitignored davintrade-security-monitoring-pipeline/):
//   reports/behaviour-input.json          the telemetry snapshot, written by whatever collects logs
//   behaviour-settings.json               yours: the baseline for `main`, acknowledged commits, the
//                                         address of the gateway health endpoint
//   reports/behaviour-queue-samples.json  written by this tool: the queue samples of the last 24 h

import { join } from 'node:path';
import {
  BEHAVIOUR_USAGE,
  BehaviourUsageError,
  parseBehaviourArgs,
  parseBehaviourSettings,
  renderBehaviourMarkdown,
  renderBehaviourStdout,
  runBehaviourSignals,
} from './behaviour-signals-lib.mjs';
import { findPrivacyViolations, resolveSecrets } from './line-notifier-lib.mjs';
import { resolveGithubToken } from './security-pipeline-intel.mjs';
import { PolicyError, loadInventory } from './security-pipeline-lib.mjs';

const safeLog = (log) => (line) =>
  log(
    findPrivacyViolations(line).length > 0
      ? '[line withheld by the privacy guard]'
      : line
  );

/** Where the private files and the reports live, for a private folder. */
export function behaviourPaths({ pipelineDir }) {
  const reportsDir = join(pipelineDir, 'reports');
  return {
    reportsDir,
    settings: join(pipelineDir, 'behaviour-settings.json'),
    input: join(reportsDir, 'behaviour-input.json'),
    history: join(reportsDir, 'behaviour-queue-samples.json'),
    json: join(reportsDir, 'latest-behaviour-signals.json'),
    markdown: join(reportsDir, 'latest-behaviour-signals.md'),
  };
}

function readJson(fs, path) {
  const text = fs.readText(path);
  if (text === null) return { present: false, value: null, invalid: false };
  try {
    return { present: true, value: JSON.parse(text), invalid: false };
  } catch {
    return { present: true, value: null, invalid: true };
  }
}

/**
 * Reads the private files, runs the probes and the sweep, and saves the queue samples. Never
 * throws for a bad file or a failing probe: both become notes and unavailable checks.
 *
 * @param {{
 *   fs: { readText: (p: string) => string | null, writeText: (p: string, t: string) => void, mkdirp: (p: string) => void },
 *   paths: ReturnType<typeof behaviourPaths>,
 *   inventory: object | null,
 *   createProbes?: (input: { token: string | null, repo: string, gatewayHealthUrl: string | null }) => object,
 *   token: string | null,
 *   repo: string,
 *   now: Date,
 *   offline: boolean,
 * }} input
 */
export async function collectBehaviour({
  fs,
  paths,
  inventory,
  createProbes,
  token,
  repo,
  now,
  offline,
}) {
  const settings = readJson(fs, paths.settings);
  const input = readJson(fs, paths.input);
  const history = readJson(fs, paths.history);
  const notes = [];
  if (settings.invalid) {
    notes.push('behaviour-settings.json is not valid JSON and was ignored');
  }
  if (input.invalid) {
    notes.push('behaviour-input.json is not valid JSON and was ignored');
  }
  let queueHistory = [];
  if (
    history.invalid ||
    (history.present && !Array.isArray(history.value?.samples))
  ) {
    notes.push('behaviour-queue-samples.json was unreadable and was ignored');
  } else if (history.present) {
    queueHistory = history.value.samples;
  }

  // the address of the gateway health endpoint is read here and handed to the probe: the sweep
  // itself never sees it, so it cannot reach a report
  const gatewayHealthUrl = parseBehaviourSettings(
    settings.invalid ? null : settings.value
  ).queueHealthUrl;
  let probes = null;
  try {
    probes = createProbes?.({ token, repo, gatewayHealthUrl }) ?? null;
  } catch {
    probes = null; // the live signals are then unavailable
  }

  const result = await runBehaviourSignals({
    inventory,
    input: input.invalid ? null : input.value,
    settings: settings.invalid ? null : settings.value,
    queueHistory,
    probes,
    now,
    offline,
    repo,
  });
  result.notes = [...notes, ...result.notes];

  // a sample taken now joins the series the next run reads
  if (result.queue.live === 'ok') {
    try {
      fs.mkdirp(paths.reportsDir);
      fs.writeText(
        paths.history,
        `${JSON.stringify(
          {
            schema_version: '1.0',
            updated_at: now.toISOString(),
            samples: result.queue.samples,
          },
          null,
          2
        )}\n`
      );
    } catch {
      result.notes.push(
        'behaviour-queue-samples.json could not be written; BS-5 cannot build its series'
      );
      result.run.degraded = true;
    }
  }
  return result;
}

/**
 * Runs one sweep on its own and returns the exit code (0 done, 1 unexpected failure, 2 usage or
 * setup error).
 *
 * @param {{
 *   argv: string[],
 *   env: Record<string, string | undefined>,
 *   deps: {
 *     root: string,
 *     fs: { readText: (p: string) => string | null, writeText: (p: string, t: string) => void, mkdirp: (p: string) => void },
 *     createProbes: (input: { token: string | null, repo: string, gatewayHealthUrl: string | null }) => object,
 *     now: () => Date,
 *     log: (line: string) => void,
 *     credentialFill?: () => string | null,
 *   },
 * }} input
 */
export async function runBehaviourCli({ argv, env, deps }) {
  let options;
  try {
    options = parseBehaviourArgs(argv);
  } catch (error) {
    if (!(error instanceof BehaviourUsageError)) throw error;
    deps.log(`error=usage (${error.message})`);
    deps.log(BEHAVIOUR_USAGE);
    return 2;
  }
  if (options.help) {
    deps.log(BEHAVIOUR_USAGE);
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
  const paths = behaviourPaths({ pipelineDir });

  const inventoryText = fs.readText(
    join(root, 'security', 'security-inventory.yaml')
  );
  if (inventoryText === null) throw new PolicyError('inventory_not_found');
  const inventory = loadInventory(inventoryText);

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

  const result = await collectBehaviour({
    fs,
    paths,
    inventory,
    createProbes: deps.createProbes,
    token,
    repo: options.repo,
    now: deps.now(),
    offline: options.offline,
  });

  try {
    fs.mkdirp(paths.reportsDir);
    fs.writeText(paths.json, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeText(paths.markdown, renderBehaviourMarkdown(result));
  } catch {
    out('error=report_write_failed');
    return 1;
  }

  for (const line of renderBehaviourStdout(result)) out(line);
  out(
    'reports: latest-behaviour-signals.json and .md written (private, gitignored)'
  );
  return 0;
}
