// Pack install/uninstall lifecycle (#276). The PackRegistry holds the set of
// installed packs, registers their contributed nodes into a NodeCatalog, and
// exposes install/uninstall with full validation. Persistence is handled by
// the backend REST layer; this module is the frontend-side state manager.

import { NodeCatalog } from '../nodeCatalog';
import { IR_VERSION } from '../blueprintIR';
import {
  CatalogInfo,
  ManifestCheck,
  PackManifest,
  SemVer,
  checkCompatibility,
  checkDependencies,
  compareSemVer,
  validateManifest,
} from './packManifest';

// Current node catalog schema version.
export const CATALOG_VERSION: SemVer = '1.0.0';

export interface InstalledPack {
  manifest: PackManifest;
  installedAt: string;
}

/**
 * In-memory pack registry. Wraps a NodeCatalog and manages the install/uninstall
 * lifecycle for packs. The registry is authoritative for which node types are
 * available at runtime; the backend persists pack records in plugin_registry
 * (runtime = 'PACK').
 */
export class PackRegistry {
  private readonly packs = new Map<string, InstalledPack>();
  private readonly catalog: NodeCatalog;

  constructor(catalog: NodeCatalog) {
    this.catalog = catalog;
  }

  // -------------------------------------------------------------------------
  // Install
  // -------------------------------------------------------------------------

  /**
   * Install a pack into the registry.
   *
   * Steps:
   * 1. Validate the manifest structure and contributed descriptors.
   * 2. Check catalog/IR compatibility.
   * 3. Check dependency satisfaction.
   * 4. Reject if a pack with the same id is already installed at the same or newer version.
   * 5. Register contributed nodes into the catalog.
   * 6. Record the pack as installed.
   */
  install(manifest: PackManifest): ManifestCheck {
    const structuralCheck = validateManifest(manifest, this.catalog);
    if (!structuralCheck.ok) return structuralCheck;

    const catalogInfo: CatalogInfo = { version: CATALOG_VERSION };
    const compatCheck = checkCompatibility(manifest, catalogInfo, IR_VERSION);
    if (!compatCheck.ok) return compatCheck;

    const installedVersions = this.installedVersionMap();
    const depCheck = checkDependencies(manifest, installedVersions);
    if (!depCheck.ok) return depCheck;

    // Version conflict: reject if already installed and the installed version is >= new version.
    const existing = this.packs.get(manifest.id);
    if (existing) {
      if (compareSemVer(existing.manifest.version, manifest.version) >= 0) {
        return {
          ok: false,
          reason: `Pack "${manifest.id}" version ${existing.manifest.version} is already installed (new: ${manifest.version})`,
        };
      }
    }

    // Register nodes into the catalog.
    for (const node of manifest.contributes.nodes ?? []) {
      this.catalog.register(node);
    }

    this.packs.set(manifest.id, {
      manifest,
      installedAt: new Date().toISOString(),
    });

    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Uninstall
  // -------------------------------------------------------------------------

  /**
   * Uninstall a pack. Returns an error if the pack is not installed or if
   * another installed pack depends on it.
   *
   * Note: nodes contributed by the pack remain in the NodeCatalog for the
   * lifetime of the runtime (node descriptors are immutable once registered).
   * The catalog does not support removal to avoid breaking loaded blueprints.
   */
  uninstall(packId: string): ManifestCheck {
    if (!this.packs.has(packId)) {
      return { ok: false, reason: `Pack "${packId}" is not installed` };
    }

    // Reject if any remaining pack depends on this one.
    for (const [id, installed] of this.packs) {
      if (id === packId) continue;
      const deps = installed.manifest.dependencies ?? [];
      if (deps.some((d) => d.id === packId)) {
        return {
          ok: false,
          reason: `Cannot uninstall "${packId}": pack "${id}" depends on it`,
        };
      }
    }

    this.packs.delete(packId);
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Query
  // -------------------------------------------------------------------------

  get(packId: string): InstalledPack | undefined {
    return this.packs.get(packId);
  }

  has(packId: string): boolean {
    return this.packs.has(packId);
  }

  list(): InstalledPack[] {
    return [...this.packs.values()];
  }

  /** Map of packId → installed version, used for dependency checks. */
  installedVersionMap(): Map<string, SemVer> {
    const m = new Map<string, SemVer>();
    for (const [id, p] of this.packs) m.set(id, p.manifest.version);
    return m;
  }
}
