// Pack manifest schema (#276). A pack bundles node descriptors, blueprint IRs,
// and declared capabilities into a single versioned, distributable unit.
// Packs are installed into the node catalog and blueprint registry.

import { NodeDescriptor, validateDescriptor } from '../nodeModel';
import { BlueprintIR, validateIR } from '../blueprintIR';
import { NodeCatalog } from '../nodeCatalog';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/** Semantic version string: "MAJOR.MINOR.PATCH" */
export type SemVer = string;

/**
 * A pack dependency: a reference to another pack that must already be installed
 * at a compatible version before this pack can be installed.
 */
export interface PackDependency {
  id: string;
  /** Minimum required version of the dependency (inclusive). */
  minVersion: SemVer;
}

/**
 * The root manifest of a distributable pack.
 *
 * Designed so it can be serialized to JSON and checked into a registry.
 * The pack is stored in plugin_registry with runtime = 'PACK'.
 */
export interface PackManifest {
  /** Unique pack identifier (reverse-domain style: "com.example.my-pack"). */
  id: string;
  /** Semantic version of this pack release. */
  version: SemVer;
  /** Human-readable name. */
  name: string;
  description?: string;
  author?: string;
  /**
   * Minimum IR_VERSION the pack was authored against.
   * The runtime rejects the pack if the catalog is older.
   */
  minIrVersion?: number;
  /**
   * Minimum node-catalog schema version required.
   * Used for semantic compatibility checks.
   */
  minCatalogVersion?: SemVer;
  /** Node descriptors contributed by this pack (validated on install). */
  contributes: {
    nodes?: NodeDescriptor[];
    blueprints?: BlueprintIR[];
  };
  /** Other packs this pack depends on. */
  dependencies?: PackDependency[];
  /** Capabilities this pack as a whole declares (union of all node caps). */
  capabilities?: string[];
}

// ---------------------------------------------------------------------------
// Semantic versioning
// ---------------------------------------------------------------------------

/**
 * Parse a semver string into [major, minor, patch].
 * Returns null if the string is not a valid semver.
 */
export function parseSemVer(v: SemVer): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * Compare two semver strings.
 * Returns negative if a < b, 0 if equal, positive if a > b.
 * Throws if either string is not a valid semver.
 */
export function compareSemVer(a: SemVer, b: SemVer): number {
  const pa = parseSemVer(a);
  const pb = parseSemVer(b);
  if (!pa) throw new Error(`Invalid semver: "${a}"`);
  if (!pb) throw new Error(`Invalid semver: "${b}"`);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/** Returns true if `version` satisfies `>= minVersion`. */
export function satisfiesMin(version: SemVer, minVersion: SemVer): boolean {
  return compareSemVer(version, minVersion) >= 0;
}

// ---------------------------------------------------------------------------
// Manifest validation
// ---------------------------------------------------------------------------

export type ManifestCheck = { ok: true } | { ok: false; reason: string };

/**
 * Validate a PackManifest structurally and against the active node catalog.
 *
 * Checks:
 * 1. Required fields are present and non-empty.
 * 2. Version is a valid semver.
 * 3. All contributed node descriptors are structurally valid.
 * 4. All contributed blueprints validate against a catalog that includes the pack's nodes.
 * 5. All dependency version strings are valid semvers.
 * 6. minCatalogVersion (if present) is a valid semver.
 */
export function validateManifest(manifest: PackManifest, baseCatalog: NodeCatalog): ManifestCheck {
  if (!manifest.id || !manifest.id.trim()) {
    return { ok: false, reason: 'manifest.id is required' };
  }
  if (!manifest.name || !manifest.name.trim()) {
    return { ok: false, reason: 'manifest.name is required' };
  }
  if (!manifest.version) {
    return { ok: false, reason: 'manifest.version is required' };
  }
  if (!parseSemVer(manifest.version)) {
    return { ok: false, reason: `manifest.version "${manifest.version}" is not a valid semver (expected MAJOR.MINOR.PATCH)` };
  }
  if (manifest.minCatalogVersion && !parseSemVer(manifest.minCatalogVersion)) {
    return { ok: false, reason: `manifest.minCatalogVersion "${manifest.minCatalogVersion}" is not a valid semver` };
  }

  // Validate contributed nodes
  for (const node of manifest.contributes.nodes ?? []) {
    const check = validateDescriptor(node);
    if (!check.ok) {
      return { ok: false, reason: `Contributed node '${node.type}': ${check.reason}` };
    }
  }

  // Build a temporary catalog merging base + pack nodes for blueprint validation
  const tempCatalog = new NodeCatalog();
  for (const node of baseCatalog.list()) tempCatalog.register(node);
  for (const node of manifest.contributes.nodes ?? []) {
    try { tempCatalog.register(node); } catch { /* already checked above */ }
  }

  // Validate contributed blueprints against the merged catalog
  for (const bp of manifest.contributes.blueprints ?? []) {
    const check = validateIR(bp, tempCatalog);
    if (!check.ok) {
      return { ok: false, reason: `Contributed blueprint '${bp.metadata.name}': ${check.reason}` };
    }
  }

  // Validate dependency version strings
  for (const dep of manifest.dependencies ?? []) {
    if (!dep.id?.trim()) {
      return { ok: false, reason: 'Dependency id is required' };
    }
    if (!parseSemVer(dep.minVersion)) {
      return { ok: false, reason: `Dependency "${dep.id}" minVersion "${dep.minVersion}" is not a valid semver` };
    }
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Compatibility check
// ---------------------------------------------------------------------------

export interface CatalogInfo {
  /** The installed catalog schema version (semver). */
  version: SemVer;
}

/**
 * Check pack/catalog compatibility.
 *
 * A pack is compatible when:
 * - Its minCatalogVersion (if set) is ≤ the installed catalog version.
 * - Its minIrVersion (if set) is ≤ IR_VERSION.
 */
export function checkCompatibility(
  manifest: PackManifest,
  catalog: CatalogInfo,
  irVersion: number,
): ManifestCheck {
  if (manifest.minCatalogVersion) {
    if (!satisfiesMin(catalog.version, manifest.minCatalogVersion)) {
      return {
        ok: false,
        reason: `Pack "${manifest.id}" requires catalog >= ${manifest.minCatalogVersion}, but installed catalog is ${catalog.version}`,
      };
    }
  }
  if (manifest.minIrVersion !== undefined) {
    if (irVersion < manifest.minIrVersion) {
      return {
        ok: false,
        reason: `Pack "${manifest.id}" requires IR version >= ${manifest.minIrVersion}, but runtime IR version is ${irVersion}`,
      };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Dependency resolution
// ---------------------------------------------------------------------------

/**
 * Check that all declared dependencies are satisfied by the set of already-
 * installed packs.
 */
export function checkDependencies(
  manifest: PackManifest,
  installed: Map<string, SemVer>,
): ManifestCheck {
  for (const dep of manifest.dependencies ?? []) {
    const installedVersion = installed.get(dep.id);
    if (!installedVersion) {
      return { ok: false, reason: `Missing dependency: pack "${dep.id}" is not installed` };
    }
    if (!satisfiesMin(installedVersion, dep.minVersion)) {
      return {
        ok: false,
        reason: `Dependency "${dep.id}" requires >= ${dep.minVersion}, but ${installedVersion} is installed`,
      };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Derive capabilities from manifest
// ---------------------------------------------------------------------------

/**
 * Derive the union of all capability strings from the pack's contributed nodes.
 * Falls back to manifest.capabilities if the node list is empty.
 */
export function derivePackCapabilities(manifest: PackManifest): string[] {
  const caps = new Set<string>(manifest.capabilities ?? []);
  for (const node of manifest.contributes.nodes ?? []) {
    if (node.capability) caps.add(node.capability);
  }
  return [...caps].sort();
}
