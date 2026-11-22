// What the Phase 5 shift-left scans cover (Trivy for the container files, OSV-Scanner for the Python
// manifests), read from security/security-inventory.yaml so there is one list and no second copy to
// drift. Pure functions: the file reads are injected, nothing here prints, and every problem is a
// fixed code (a path or a line of a file is never repeated).
//
// Trivy reads a Dockerfile as infrastructure-as-code and an image as a package list. It has no check
// for a Docker Compose file or a nixpacks.toml, so those are listed as "not scannable" (counted, and
// said out loud) and the images a Compose file names are scanned as images instead.

import { loadInventory } from './security-pipeline-lib.mjs';

// An image reference the workflow may pass to a command: lower-case path words, one optional tag and
// one optional sha256 digest. Anything else (a build argument, a shell word) is an issue, not a target.
const IMAGE_REF_RE =
  /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*(?::[A-Za-z0-9_][A-Za-z0-9._-]{0,127})?(?:@sha256:[0-9a-f]{64})?$/;

// a path the workflow may pass to a command or copy: plain path words, no `..`
const REPO_PATH_RE = /^[A-Za-z0-9._][A-Za-z0-9._/-]*$/;

export const isImageRef = (value) =>
  typeof value === 'string' && IMAGE_REF_RE.test(value);

export const isRepoPath = (value) =>
  typeof value === 'string' &&
  REPO_PATH_RE.test(value) &&
  !value.split('/').includes('..');

/**
 * The base images of a Dockerfile: every `FROM`, except `scratch` and the name of an earlier build
 * stage. An image named through a build argument cannot be resolved here and is counted apart.
 *
 * @returns {{ images: string[], unresolved: number }}
 */
export function parseDockerfileImages(text) {
  const stages = new Set();
  const images = [];
  let unresolved = 0;
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const m = /^FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?\s*$/i.exec(
      raw.trim()
    );
    if (!m) continue;
    const [, ref, alias] = m;
    const name = ref.toLowerCase();
    if (name === 'scratch' || stages.has(name)) {
      // not an image to pull
    } else if (ref.includes('$')) {
      unresolved += 1;
    } else {
      images.push(ref);
    }
    if (alias) stages.add(alias.toLowerCase());
  }
  return { images, unresolved };
}

/**
 * The images a Docker Compose file pulls (`image:` entries). A service that is only built
 * (`build:`) has none, and an entry that uses a variable cannot be resolved here.
 *
 * @returns {{ images: string[], unresolved: number }}
 */
export function parseComposeImages(text) {
  const images = [];
  let unresolved = 0;
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const m = /^\s*image:\s*['"]?([^\s'"#]+)['"]?\s*(?:#.*)?$/.exec(raw);
    if (!m) continue;
    if (m[1].includes('$')) unresolved += 1;
    else images.push(m[1]);
  }
  return { images, unresolved };
}

/**
 * Counts the requirement lines of a pip requirements file and how many are not pinned to one version
 * (`==` or `===`). Options (`-r`, `--hash`, ...), comments and blank lines are not requirements.
 */
export function countRequirementPins(text) {
  let requirements = 0;
  let unpinned = 0;
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    // a trailing comment and a line continuation (the `--hash` lines that follow) are not part of it
    const line = raw
      .replace(/\s+#.*$/, '')
      .replace(/\s*\\\s*$/, '')
      .trim();
    if (line === '' || line.startsWith('#') || line.startsWith('-')) continue;
    requirements += 1;
    // name[extras]==version, with an optional environment marker after `;`; a wildcard is a range
    if (!PINNED_REQUIREMENT_RE.test(line)) unpinned += 1;
  }
  return { requirements, unpinned };
}

const PINNED_REQUIREMENT_RE =
  /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\[[^\]]*\])?\s*===?\s*[A-Za-z0-9._+!-]+(?:\s*;.*)?$/;

/**
 * The scan targets of the inventory. `readText(path)` returns a repository file as text or null.
 * Assets that are archived are not scanned; a paused asset is (its files are the restore gate).
 *
 * @param {{ inventory: ReturnType<typeof loadInventory>, readText?: (path: string) => string | null }} input
 */
export function collectShiftLeftTargets({ inventory, readText = () => null }) {
  const issues = new Set();
  const dockerfiles = [];
  const composeFiles = [];
  const nixpacksFiles = [];
  const pip = [];
  const images = new Set();

  const addImage = (ref) => {
    if (isImageRef(ref)) images.add(ref);
    else issues.add('image_ref_invalid');
  };
  const addPath = (list, entry) => {
    if (!isRepoPath(entry.path)) {
      issues.add('path_invalid');
      return false;
    }
    if (!list.some((e) => e.path === entry.path)) list.push(entry);
    return true;
  };

  for (const asset of inventory.assets) {
    if (asset.lifecycle === 'archived') continue;
    for (const eco of asset.ecosystems) {
      if (eco.baseImage) addImage(eco.baseImage);
      if (eco.dockerfilePath) {
        addPath(dockerfiles, { assetId: asset.id, path: eco.dockerfilePath });
      }
      if (eco.composePath) {
        addPath(composeFiles, { assetId: asset.id, path: eco.composePath });
      }
      if (eco.nixpacksPath) {
        addPath(nixpacksFiles, { assetId: asset.id, path: eco.nixpacksPath });
      }
      if (eco.type === 'pip' && eco.manifestPath) {
        const entry = {
          assetId: asset.id,
          lifecycle: asset.lifecycle,
          path: eco.manifestPath,
          scope: eco.scope ?? 'runtime',
          pinningRequired: eco.pinningRequired === true,
          requirements: 0,
          unpinned: 0,
        };
        if (!addPath(pip, entry)) continue;
        const text = readText(eco.manifestPath);
        if (text === null) issues.add('pip_manifest_unreadable');
        else Object.assign(entry, countRequirementPins(text));
      }
    }
  }

  // the images each container file names, so an image a Compose file pulls is scanned too
  let unresolvedImages = 0;
  for (const file of dockerfiles) {
    const text = readText(file.path);
    if (text === null) {
      issues.add('dockerfile_unreadable');
      continue;
    }
    const parsed = parseDockerfileImages(text);
    parsed.images.forEach(addImage);
    unresolvedImages += parsed.unresolved;
  }
  for (const file of composeFiles) {
    const text = readText(file.path);
    if (text === null) {
      issues.add('compose_unreadable');
      continue;
    }
    const parsed = parseComposeImages(text);
    parsed.images.forEach(addImage);
    unresolvedImages += parsed.unresolved;
  }
  for (const file of nixpacksFiles) {
    if (readText(file.path) === null) issues.add('nixpacks_unreadable');
  }

  return {
    dockerfiles,
    composeFiles,
    nixpacksFiles,
    images: [...images].sort(),
    unresolvedImages,
    pip,
    notScannable: [
      ...composeFiles.map(({ path }) => ({ path, kind: 'compose' })),
      ...nixpacksFiles.map(({ path }) => ({ path, kind: 'nixpacks' })),
    ],
    issues: [...issues].sort(),
  };
}

/** The same collection from the text of the inventory. */
export function loadShiftLeftTargets({ inventoryText, readText }) {
  return collectShiftLeftTargets({
    inventory: loadInventory(inventoryText),
    readText,
  });
}

/** The counts line printed by the targets command (counts and fixed words only). */
export function renderTargetsLine(targets) {
  const dev = targets.pip.filter((p) => p.scope === 'development').length;
  const unpinned = targets.pip.reduce((sum, p) => sum + p.unpinned, 0);
  return `targets: dockerfiles=${targets.dockerfiles.length} images=${targets.images.length} not_scannable=${targets.notScannable.length} pip_manifests=${targets.pip.length} pip_development=${dev} unpinned_requirement_lines=${unpinned} issues=${targets.issues.length}`;
}
