// Pure helpers for scripts/security/validate-vex.mjs.
//
// The VEX registry (security/vex-registry.json) is a public file: it holds only
// `not_affected` and `fixed` statements. Reports print counts and error codes,
// never an advisory identifier, a package name or a statement's text.

export const ALLOWED_STATUSES = Object.freeze(['not_affected', 'fixed']);

// The strict OpenVEX justifications the pipeline design allows.
export const JUSTIFICATIONS = Object.freeze([
  'vulnerable_code_not_present',
  'vulnerable_code_not_in_execute_path',
  'vulnerable_code_cannot_be_controlled_by_adversary',
  'inline_mitigations_already_exist',
]);

export const SCOPES = Object.freeze(['runtime', 'build_only', 'dev_only']);
export const MAX_REVIEW_DAYS = 180;
export const MAX_IMPACT_LENGTH = 280;

const REGISTRY_KEYS = ['schema_version', 'updated_at', 'readme', 'statements'];
const STATEMENT_KEYS = [
  'advisory_id',
  'asset_id',
  'package_spec',
  'status',
  'justification',
  'impact_statement',
  'fixed_in',
  'scope',
  'created_at',
  'review_after',
  'expires_when',
];
const EXPIRY_BOOLEAN_KEYS = [
  'when_advisory_withdrawn',
  'when_fix_available_in_range',
  'when_in_cisa_kev',
];
const EXPIRY_KEYS = [
  ...EXPIRY_BOOLEAN_KEYS,
  'when_package_absent_from_lockfile',
];

const ADVISORY_ID =
  /^(?:GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}|CVE-\d{4}-\d{4,}|PYSEC-\d{4}-\d+)$/;
const PACKAGE_SPEC = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*@\S+$/;
const ASSET_ID = /^[a-z0-9][a-z0-9-]*$/;
// A public file must not carry a URL, an IPv4 address or a Railway proxy host.
const ADDRESS_IN_TEXT = /:\/\/|\b(?:\d{1,3}\.){3}\d{1,3}\b|proxy\.rlwy\.net/i;

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return false;
  }
  const date = new Date(`${text}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
  );
}

/** Whole days from one YYYY-MM-DD date to another (negative when earlier). */
export function daysBetween(from, to) {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000
  );
}

/**
 * Asset ids of the inventory, read from the `assets:` section without a YAML
 * parser (lines of the form `  - id: some-asset`).
 *
 * @param {string} text
 * @returns {Set<string>}
 */
export function inventoryAssetIds(text) {
  const ids = new Set();
  let inAssets = false;
  for (const line of String(text).split(/\r?\n/)) {
    if (/^[A-Za-z_]/.test(line)) {
      inAssets = /^assets:\s*(?:#.*)?$/.test(line);
      continue;
    }
    if (!inAssets) continue;
    const match = /^ {2}- id:\s*([a-z0-9][a-z0-9-]*)\s*(?:#.*)?$/.exec(line);
    if (match) ids.add(match[1]);
  }
  return ids;
}

/**
 * Validates a parsed registry. Errors are `{ index, code }` with a stable code
 * and the zero-based statement index (`null` for the registry itself).
 * Statements whose `review_after` is before `today` are counted as expired:
 * that is reported, not an error, so a date passing never fails an unrelated
 * change.
 *
 * @param {unknown} registry
 * @param {{ assetIds?: Set<string> | null, today?: string }} [options]
 */
export function validateRegistry(registry, { assetIds = null, today } = {}) {
  const errors = [];
  const counts = { statements: 0, not_affected: 0, fixed: 0, expired: 0 };
  const add = (index, code) => errors.push({ index, code });

  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
    add(null, 'registry_not_object');
    return { errors, counts };
  }
  for (const key of Object.keys(registry)) {
    if (!REGISTRY_KEYS.includes(key)) add(null, 'unknown_registry_key');
  }
  if (registry.schema_version !== '1.0') add(null, 'schema_version');
  if (!isIsoDate(registry.updated_at)) add(null, 'updated_at');
  if (!Array.isArray(registry.statements)) {
    add(null, 'statements_not_array');
    return { errors, counts };
  }

  const seen = new Set();
  registry.statements.forEach((s, i) => {
    counts.statements += 1;
    if (!s || typeof s !== 'object' || Array.isArray(s)) {
      add(i, 'statement_not_object');
      return;
    }
    for (const key of Object.keys(s)) {
      if (!STATEMENT_KEYS.includes(key)) add(i, 'unknown_key');
    }

    // Identity: the compound key (advisory_id, asset_id, package_spec).
    const advisoryOk =
      typeof s.advisory_id === 'string' && ADVISORY_ID.test(s.advisory_id);
    if (typeof s.advisory_id === 'string' && /^MAL-/i.test(s.advisory_id)) {
      // A malicious package is never "not affected": it goes straight to P0.
      add(i, 'malicious_advisory');
    } else if (!advisoryOk) {
      add(i, 'advisory_id');
    }
    const assetOk = typeof s.asset_id === 'string' && ASSET_ID.test(s.asset_id);
    if (!assetOk) add(i, 'asset_id');
    else if (assetIds && !assetIds.has(s.asset_id)) add(i, 'unknown_asset');
    const specOk =
      typeof s.package_spec === 'string' && PACKAGE_SPEC.test(s.package_spec);
    if (!specOk) add(i, 'package_spec');
    if (advisoryOk && assetOk && specOk) {
      const key = [s.advisory_id, s.asset_id, s.package_spec].join('\u0000');
      if (seen.has(key)) add(i, 'duplicate_key');
      else seen.add(key);
    }

    // Status and justification.
    if (!ALLOWED_STATUSES.includes(s.status)) {
      add(i, 'status');
    } else {
      counts[s.status] += 1;
      if (s.status === 'not_affected') {
        if (s.justification === undefined) add(i, 'justification_required');
        else if (!JUSTIFICATIONS.includes(s.justification)) {
          add(i, 'justification_invalid');
        }
        if (s.fixed_in !== undefined) add(i, 'fixed_in_not_allowed');
      } else {
        if (s.justification !== undefined) add(i, 'justification_not_allowed');
        if (typeof s.fixed_in !== 'string' || !/^\S+$/.test(s.fixed_in)) {
          add(i, 'fixed_in_required');
        }
      }
    }
    if (s.scope !== undefined && !SCOPES.includes(s.scope)) add(i, 'scope');

    // Free text: short, and free of addresses.
    if (
      typeof s.impact_statement !== 'string' ||
      s.impact_statement.trim() === '' ||
      s.impact_statement.length > MAX_IMPACT_LENGTH
    ) {
      add(i, 'impact_statement');
    } else if (ADDRESS_IN_TEXT.test(s.impact_statement)) {
      add(i, 'address_in_text');
    }

    // Dates: review within the allowed window; an expired review is reported.
    const createdOk = isIsoDate(s.created_at);
    const reviewOk = isIsoDate(s.review_after);
    if (!createdOk) add(i, 'created_at');
    if (!reviewOk) add(i, 'review_after');
    if (createdOk && reviewOk) {
      const span = daysBetween(s.created_at, s.review_after);
      if (span < 0 || span > MAX_REVIEW_DAYS) add(i, 'review_window');
      if (today && s.review_after < today) counts.expired += 1;
    }

    // Auto-expiry triggers: every key optional, none may disable the
    // withdrawn-advisory trigger.
    const expires = s.expires_when;
    if (!expires || typeof expires !== 'object' || Array.isArray(expires)) {
      add(i, 'expires_when');
    } else {
      for (const key of Object.keys(expires)) {
        if (!EXPIRY_KEYS.includes(key)) add(i, 'unknown_expiry_key');
      }
      for (const key of EXPIRY_BOOLEAN_KEYS) {
        if (expires[key] !== undefined && typeof expires[key] !== 'boolean') {
          add(i, 'expires_when');
        }
      }
      if (expires.when_advisory_withdrawn === false) {
        add(i, 'withdrawn_trigger_disabled');
      }
      const absent = expires.when_package_absent_from_lockfile;
      if (
        absent !== undefined &&
        (typeof absent !== 'string' || !PACKAGE_SPEC.test(absent))
      ) {
        add(i, 'expires_when');
      }
    }
  });
  return { errors, counts };
}

/**
 * How many accepted ignores (`pnpm.auditConfig.ignoreGhsas`) have a VEX
 * statement. Counts only.
 *
 * @param {unknown} registry
 * @param {unknown[]} ignoredGhsas
 */
export function parityCounts(registry, ignoredGhsas) {
  const statements = Array.isArray(registry?.statements)
    ? registry.statements
    : [];
  const covered = new Set(
    statements
      .filter((s) => typeof s?.advisory_id === 'string')
      .map((s) => s.advisory_id.toLowerCase())
  );
  const ignored = [
    ...new Set(ignoredGhsas.map((id) => String(id).toLowerCase())),
  ];
  return {
    ignored: ignored.length,
    covered: ignored.filter((id) => covered.has(id)).length,
  };
}

/**
 * The report: counts and error codes only.
 *
 * @param {{
 *   result: { errors: {index: number | null, code: string}[], counts: Record<string, number> },
 *   assetCount: number | null,
 *   parity: { ignored: number, covered: number } | null,
 *   requireParity?: boolean,
 * }} input
 * @returns {{ exitCode: number, lines: string[] }}
 */
export function buildValidationReport({
  result,
  assetCount,
  parity,
  requireParity = false,
}) {
  const { errors, counts } = result;
  const lines = [
    `VEX registry (counts only): statements=${counts.statements} not_affected=${counts.not_affected} fixed=${counts.fixed} expired=${counts.expired}`,
    assetCount === null
      ? 'Inventory not found: asset ids not checked.'
      : `Inventory assets known: ${assetCount}`,
  ];
  const problems = errors.map(({ index, code }) =>
    index === null ? `registry: ${code}` : `statement #${index + 1}: ${code}`
  );
  if (parity) {
    lines.push(
      `Accepted ignores in package.json: ${parity.ignored}; with a VEX statement: ${parity.covered}`
    );
    if (requireParity && parity.covered < parity.ignored) {
      problems.push('registry: parity');
    }
  }
  if (problems.length === 0) {
    lines.push('RESULT: PASS');
    return { exitCode: 0, lines };
  }
  lines.push('RESULT: FAIL');
  lines.push(`::error::VEX registry: ${problems.length} problem(s).`);
  for (const problem of problems) lines.push(`  ${problem}`);
  return { exitCode: 1, lines };
}
