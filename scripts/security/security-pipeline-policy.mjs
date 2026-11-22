// Policy loading for the private security pipeline: the attack-surface
// inventory, the excluded paths and the VEX statements (public registry plus an
// optional private overlay).
//
// Pure functions: file reading is injected by the runner. Nothing here prints
// anything; errors carry fixed codes, never file content.

import { validateRegistry } from './vex-lib.mjs';
import {
  cleanVersion,
  compareVersions,
  parseVersion,
  satisfies,
} from './security-semver-lite.mjs';
import { parseYaml } from './security-yaml-lite.mjs';

export class PolicyError extends Error {}

export const LIFECYCLES = Object.freeze([
  'production',
  'paused',
  'pre_cutover',
  'needs_owner_confirmation',
  'archived',
]);

const asArray = (value) => (Array.isArray(value) ? value : []);
const asStringArray = (value) =>
  asArray(value).filter((item) => typeof item === 'string');
const asText = (value) => (typeof value === 'string' ? value : null);

/**
 * Turns the parsed inventory (schema 3.0) into the shape the engine uses.
 * @param {unknown} doc
 */
export function normalizeInventory(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new PolicyError('inventory_not_a_mapping');
  }
  if (String(doc.schema_version) !== '3.0') {
    throw new PolicyError('inventory_schema_version');
  }

  const pins = doc.toolchain_pins ?? {};
  const nodeFloors = {};
  for (const [key, value] of Object.entries(pins.node_runtime_floors ?? {})) {
    const m = /^v(\d+)_min_patch$/.exec(key);
    if (!m) continue;
    const version = cleanVersion(value);
    if (!version) throw new PolicyError('inventory_node_floor');
    nodeFloors[m[1]] = version;
  }
  if (Object.keys(nodeFloors).length === 0) {
    throw new PolicyError('inventory_node_floor');
  }

  const seen = new Set();
  const assets = asArray(doc.assets).map((raw) => {
    const asset = normalizeAsset(raw);
    if (seen.has(asset.id)) throw new PolicyError('inventory_duplicate_asset');
    seen.add(asset.id);
    return asset;
  });
  if (assets.length === 0) throw new PolicyError('inventory_no_assets');

  return {
    schemaVersion: '3.0',
    updatedAt: asText(doc.updated_at),
    toolchain: {
      pnpmVersion: cleanVersion(pins.pnpm_version),
      nodeFloors,
    },
    expectedPublicEndpoints: asStringArray(doc.expected_public_endpoints),
    excludedPaths: asStringArray(doc.excluded_paths),
    assets,
  };
}

function normalizeAsset(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') {
    throw new PolicyError('inventory_asset_id');
  }
  if (!LIFECYCLES.includes(raw.lifecycle)) {
    throw new PolicyError('inventory_asset_lifecycle');
  }
  return {
    id: raw.id,
    name: asText(raw.name) ?? raw.id,
    lifecycle: raw.lifecycle,
    exposureTier: Number.isInteger(raw.exposure_tier)
      ? raw.exposure_tier
      : null,
    escalationRequired: raw.escalation_required === true,
    trustBoundaries: asStringArray(raw.trust_boundaries),
    buildOnlyPackages: new Set(asStringArray(raw.build_only_packages)),
    publicEndpoints: asStringArray(raw.public_endpoints),
    runtime:
      raw.runtime && typeof raw.runtime === 'object' ? raw.runtime : null,
    ecosystems: asArray(raw.ecosystems)
      .filter((eco) => eco && typeof eco === 'object')
      .map((eco) => ({
        type: asText(eco.type),
        manifestPath: asText(eco.manifest_path),
        lockfilePath: asText(eco.lockfile_path),
        workspaceImporters: asStringArray(eco.include_workspace_importers),
        pinningRequired: eco.pinning_required === true,
        baseImage: asText(eco.base_image),
        dockerfilePath: asText(eco.dockerfile_path),
      })),
  };
}

/** Parses and normalizes the inventory text. */
export function loadInventory(text) {
  let doc;
  try {
    doc = parseYaml(text);
  } catch {
    throw new PolicyError('inventory_unreadable');
  }
  return normalizeInventory(doc);
}

const normalizePath = (path) =>
  String(path ?? '')
    .replace(/\\/g, '/')
    .replace(/^(\.\/|\/)+/, '');

/**
 * True when a repository path falls under an excluded-path pattern. A pattern
 * `dir/**` matches everything under `dir/`; any other pattern matches that exact
 * path.
 */
export function isExcludedPath(path, patterns) {
  const normalized = normalizePath(path);
  if (normalized === '' || normalized.split('/').includes('..')) return false;
  return patterns.some((pattern) => {
    const p = normalizePath(pattern);
    return p.endsWith('/**')
      ? normalized.startsWith(p.slice(0, -2))
      : normalized === p;
  });
}

// --- VEX ---------------------------------------------------------------------

/**
 * Validates the public registry and the optional private overlay and merges
 * their statements. An invalid file contributes nothing (that can only show
 * more findings, never fewer) and its error codes are returned.
 *
 * @param {{
 *   publicRegistry: unknown,
 *   privateRegistry?: unknown,
 *   assetIds: Set<string>,
 *   today: string,
 * }} input
 */
export function mergeVexRegistries({
  publicRegistry,
  privateRegistry = null,
  assetIds,
  today,
}) {
  const statements = [];
  const status = {
    public: {
      present: publicRegistry != null,
      valid: true,
      errors: [],
      count: 0,
    },
    private: {
      present: privateRegistry != null,
      valid: true,
      errors: [],
      count: 0,
    },
  };
  for (const [source, registry] of [
    ['public', publicRegistry],
    ['private', privateRegistry],
  ]) {
    if (registry == null) continue;
    const result = validateRegistry(registry, { assetIds, today });
    if (result.errors.length > 0) {
      status[source].valid = false;
      status[source].errors = result.errors.map(({ index, code }) =>
        index === null ? code : `#${index + 1}:${code}`
      );
      continue;
    }
    status[source].count = registry.statements.length;
    for (const statement of registry.statements) {
      statements.push({ ...statement, source });
    }
  }
  // the same compound key in both files: the private overlay does not shadow it
  const keyOf = (s) =>
    [s.advisory_id.toLowerCase(), s.asset_id, s.package_spec].join('\u0000');
  const seen = new Set();
  const unique = [];
  for (const s of statements) {
    const key = keyOf(s);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
  }
  return { statements: unique, status };
}

function splitSpec(spec) {
  const at = String(spec).lastIndexOf('@');
  if (at <= 0) return null;
  return { name: spec.slice(0, at), version: spec.slice(at + 1) };
}

/**
 * Whether a VEX statement describes a finding (same advisory, asset and package;
 * the version part of `package_spec` may be exact, a range or `*`; an optional
 * `scope` must agree).
 */
export function vexStatementMatches(statement, finding) {
  if (statement.asset_id !== finding.assetId) return false;
  const wanted = String(statement.advisory_id).toLowerCase();
  if (!finding.advisoryIds.some((id) => id.toLowerCase() === wanted)) {
    return false;
  }
  const spec = splitSpec(statement.package_spec);
  if (!spec || spec.name !== finding.packageName) return false;
  if (spec.version !== '*' && spec.version !== finding.version) {
    if (!satisfies(finding.version, spec.version)) return false;
  }
  return !statement.scope || statement.scope === finding.scope;
}

/**
 * Why a matching statement no longer counts. An empty list means it is active.
 *
 * @param {object} statement
 * @param {{ withdrawn?: boolean, inKev?: boolean, fixInRange?: boolean, version?: string }} finding
 * @param {{ today: string }} context
 */
export function vexExpiryReasons(statement, finding, { today }) {
  const reasons = [];
  const expires = statement.expires_when ?? {};
  if (statement.review_after < today) reasons.push('review_expired');
  if (expires.when_advisory_withdrawn !== false && finding.withdrawn) {
    reasons.push('advisory_withdrawn');
  }
  if (expires.when_fix_available_in_range === true && finding.fixInRange) {
    reasons.push('fix_available_in_range');
  }
  if (expires.when_in_cisa_kev === true && finding.inKev) {
    reasons.push('in_cisa_kev');
  }
  if (statement.status === 'fixed') {
    // `fixed` only describes a version at or above the fix
    const order = compareVersions(finding.version, statement.fixed_in);
    if (order === null || order < 0) reasons.push('not_yet_fixed');
  }
  return reasons;
}

/**
 * Statements whose `when_package_absent_from_lockfile` package is no longer in
 * the asset's lockfile: leftovers to clean up.
 *
 * @param {object[]} statements
 * @param {(assetId: string) => Set<string> | null} lockKeysFor `name@version` keys
 */
export function staleVexStatements(statements, lockKeysFor) {
  return statements.filter((s) => {
    const absent = s.expires_when?.when_package_absent_from_lockfile;
    if (typeof absent !== 'string') return false;
    const keys = lockKeysFor(s.asset_id);
    if (!keys) return false;
    const spec = splitSpec(absent);
    if (!spec) return false;
    if (keys.has(absent)) return false;
    // an exact version is absent; a range or `*` is absent when no version matches
    if (parseVersion(spec.version)) return true;
    for (const key of keys) {
      const k = splitSpec(key);
      if (k && k.name === spec.name && satisfies(k.version, spec.version)) {
        return false;
      }
    }
    return true;
  });
}
