// The install/activate lifecycle engine for workspace plugins.
//
// install(id)    resolve deps → persist as installed → activate (lazy-load the
//                chunk, run activate(), collect its contributions)
// uninstall(id)  refuse if an installed plugin depends on it → deactivate →
//                dispose its contributions → drop the install record
// enable/disable activate/deactivate without touching the install record
//
// A not-installed plugin's `load()` is never called, so its code never enters
// the page. Activation and rendering are fault-isolated so a broken plugin
// cannot take down the host or the other installed plugins.

import type {
  Contributions,
  EditorActionContribution,
  InstalledRecord,
  InstallPhase,
  NoteFenceContribution,
  NotePanelContribution,
  PluginContext,
  PluginManifest,
  PluginModule,
  ViewContribution,
} from './types';
import { isRunnable } from './types';

const STORE_KEY = 'modulo-plugins-installed';
const LEGACY_KEY = 'modulo-plugins';

interface ActiveEntry {
  views: ViewContribution[];
  notePanels: NotePanelContribution[];
  noteFences: NoteFenceContribution[];
  editorActions: EditorActionContribution[];
  deactivate?: () => void | Promise<void>;
}

export class PluginRuntime {
  private readonly catalog = new Map<string, PluginManifest>();
  private readonly installed = new Map<string, InstalledRecord>();
  private readonly active = new Map<string, ActiveEntry>();
  private readonly phases = new Map<string, InstallPhase>();
  private readonly errors = new Map<string, string>();
  private readonly listeners = new Set<() => void>();

  constructor(catalog: PluginManifest[]) {
    for (const m of catalog) this.catalog.set(m.id, m);
    this.restoreInstalled();
  }

  // ── Subscription ───────────────────────────────────────────────────────────

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  getCatalog(): PluginManifest[] {
    return [...this.catalog.values()];
  }
  getManifest(id: string): PluginManifest | undefined {
    return this.catalog.get(id);
  }
  isInstalled(id: string): boolean {
    return this.installed.has(id);
  }
  isEnabled(id: string): boolean {
    return this.installed.get(id)?.enabled ?? false;
  }
  isActive(id: string): boolean {
    return this.active.has(id);
  }
  installedIds(): Set<string> {
    return new Set(this.installed.keys());
  }
  phaseOf(id: string): InstallPhase {
    return this.phases.get(id) ?? 'idle';
  }
  errorOf(id: string): string | undefined {
    return this.errors.get(id);
  }
  /** Installed plugins that declare `id` as a dependency (blocks uninstall). */
  dependents(id: string): string[] {
    return [...this.installed.keys()].filter((other) =>
      (this.catalog.get(other)?.dependencies ?? []).includes(id),
    );
  }

  /** Aggregated, ordered contributions across all currently-active plugins. */
  contributions(): Contributions {
    const views: ViewContribution[] = [];
    const notePanels: NotePanelContribution[] = [];
    const noteFences: NoteFenceContribution[] = [];
    const editorActions: EditorActionContribution[] = [];
    for (const entry of this.active.values()) {
      views.push(...entry.views);
      notePanels.push(...entry.notePanels);
      noteFences.push(...entry.noteFences);
      editorActions.push(...entry.editorActions);
    }
    views.sort((a, b) => a.order - b.order);
    notePanels.sort((a, b) => a.order - b.order);
    return { views, notePanels, noteFences, editorActions };
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private restoreInstalled() {
    const records = this.loadRecords();
    for (const rec of records) {
      // Only keep records that still map to a runnable catalog entry.
      const m = this.catalog.get(rec.id);
      if (m && isRunnable(m)) this.installed.set(rec.id, rec);
    }
  }

  private loadRecords(): InstalledRecord[] {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw) as InstalledRecord[];
    } catch {
      /* fall through to migration / defaults */
    }
    // Migrate the old flat id list, or seed built-in defaults on first run.
    let ids: string[] | null = null;
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) ids = JSON.parse(legacy) as string[];
    } catch {
      /* ignore */
    }
    if (!ids) {
      ids = this.getCatalog()
        .filter((m) => m.builtin && isRunnable(m))
        .map((m) => m.id);
    }
    return ids
      .map((id) => this.catalog.get(id))
      .filter((m): m is PluginManifest => Boolean(m) && isRunnable(m!))
      .map((m) => ({ id: m.id, version: m.version, enabled: true }));
  }

  private persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify([...this.installed.values()]));
    } catch {
      /* storage full/unavailable — state still applies for this session */
    }
  }

  // ── Activation ─────────────────────────────────────────────────────────────

  /** Activate every installed + enabled plugin. Call once on boot. */
  async init(): Promise<void> {
    await Promise.all(
      [...this.installed.values()]
        .filter((r) => r.enabled)
        .map((r) => this.activate(r.id)),
    );
    this.emit();
  }

  private async activate(id: string): Promise<void> {
    if (this.active.has(id)) return;
    const manifest = this.catalog.get(id);
    if (!manifest?.load) return;

    const entry: ActiveEntry = { views: [], notePanels: [], noteFences: [], editorActions: [] };
    const ctx: PluginContext = {
      addView: (v) => entry.views.push(v),
      addNotePanel: (p) => entry.notePanels.push(p),
      addNoteFence: (f) => entry.noteFences.push(f),
      addEditorAction: (a) => entry.editorActions.push(a),
    };

    try {
      const mod = await manifest.load();
      const plugin: PluginModule = 'default' in mod ? mod.default : mod;
      await plugin.activate(ctx);
      entry.deactivate = plugin.deactivate;
      this.active.set(id, entry);
      this.errors.delete(id);
    } catch (err) {
      // Isolation: a failed activation must not break the host or other plugins.
      this.errors.set(id, err instanceof Error ? err.message : 'Activation failed');
      this.setPhase(id, 'error');
    }
  }

  private async deactivate(id: string): Promise<void> {
    const entry = this.active.get(id);
    if (!entry) return;
    this.active.delete(id);
    try {
      await entry.deactivate?.();
    } catch {
      /* teardown errors are non-fatal — the contributions are already dropped */
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  private setPhase(id: string, phase: InstallPhase) {
    if (phase === 'idle') this.phases.delete(id);
    else this.phases.set(id, phase);
    this.emit();
  }

  /**
   * Install a plugin: resolve and install its dependencies first, persist the
   * install record, then activate it. Idempotent for already-installed plugins.
   */
  async install(id: string): Promise<void> {
    const manifest = this.catalog.get(id);
    if (!manifest) throw new Error(`Unknown plugin '${id}'`);
    if (!isRunnable(manifest)) throw new Error(`Plugin '${id}' is not installable`);
    if (this.installed.has(id)) return;

    this.setPhase(id, 'installing');
    try {
      for (const depId of manifest.dependencies ?? []) {
        if (!this.installed.has(depId)) await this.install(depId);
      }
      this.installed.set(id, { id, version: manifest.version, enabled: true });
      this.persist();
      await this.activate(id);
      this.setPhase(id, this.errors.has(id) ? 'error' : 'idle');
    } catch (err) {
      this.installed.delete(id);
      this.persist();
      this.errors.set(id, err instanceof Error ? err.message : 'Install failed');
      this.setPhase(id, 'error');
      throw err;
    }
  }

  /**
   * Uninstall a plugin. Refuses if another installed plugin depends on it, so
   * the dependency graph never breaks underneath an active plugin.
   */
  async uninstall(id: string): Promise<void> {
    if (!this.installed.has(id)) return;
    const blockers = this.dependents(id);
    if (blockers.length > 0) {
      const names = blockers.map((b) => this.catalog.get(b)?.name ?? b).join(', ');
      throw new Error(`Uninstall ${names} first — ${names} depend${blockers.length > 1 ? '' : 's'} on this plugin.`);
    }
    this.setPhase(id, 'uninstalling');
    await this.deactivate(id);
    this.installed.delete(id);
    this.errors.delete(id);
    this.persist();
    this.setPhase(id, 'idle');
  }

  /** Enable/disable without uninstalling (keeps the install record). */
  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const rec = this.installed.get(id);
    if (!rec || rec.enabled === enabled) return;
    rec.enabled = enabled;
    this.persist();
    if (enabled) await this.activate(id);
    else await this.deactivate(id);
    this.emit();
  }
}
