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
  BlueprintNodeContribution,
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
import type { PluginStateClient } from '../../../services/pluginStateClient';
import type { WorkspaceStateHost } from '../../../services/workspaceStateHost';

interface ActiveEntry {
  views: ViewContribution[];
  notePanels: NotePanelContribution[];
  noteFences: NoteFenceContribution[];
  editorActions: EditorActionContribution[];
  blueprintNodes: BlueprintNodeContribution[];
  deactivate?: () => void | Promise<void>;
}

export interface InstallationStorage {
  load: () => InstalledRecord[];
  save: (records: InstalledRecord[]) => Promise<void>;
}

export class PluginRuntime {
  private disposed = false;
  private readonly catalog = new Map<string, PluginManifest>();
  private readonly installed = new Map<string, InstalledRecord>();
  private readonly active = new Map<string, ActiveEntry>();
  private readonly phases = new Map<string, InstallPhase>();
  private readonly errors = new Map<string, string>();
  private readonly listeners = new Set<() => void>();

  constructor(catalog: PluginManifest[], private stateHost?: WorkspaceStateHost, private installationStorage?: InstallationStorage) {
    for (const m of catalog) this.catalog.set(m.id, m);
    this.restoreInstalled();
  }

  setStateHost(host: WorkspaceStateHost | undefined): void { this.stateHost = host; this.emit(); }

  state(id: string): Promise<PluginStateClient> {
    if (this.disposed || !this.isInstalled(id) || !this.isEnabled(id)) return Promise.reject(new Error('Plugin is not enabled'));
    if (!this.stateHost) return Promise.reject(new Error('Workspace synchronization is unavailable'));
    return this.stateHost.open(id);
  }

  installationRecords(): InstalledRecord[] { return [...this.installed.values()].map(record => ({ ...record })); }

  async applyInstallations(records: InstalledRecord[]): Promise<void> {
    if (this.disposed) throw new Error('Plugin runtime is closed');
    const recordsUnchanged = JSON.stringify(records) === JSON.stringify(this.installationRecords());
    const activeEntriesConsistent = [...this.active.keys()].every((id) => this.isEnabled(id));
    if (recordsUnchanged && activeEntriesConsistent) return;
    // Reconcile active entries as well as install records. An activation can
    // finish after another tab removed its record; leaving that entry alive
    // would keep its views, panels, or blueprint nodes visible indefinitely.
    const currentIds = new Set([...this.installed.keys(), ...this.active.keys()]);
    for (const id of currentIds) {
      const next = records.find(record => record.id === id);
      if (!next?.enabled) await this.deactivate(id);
    }
    this.installed.clear();
    for (const record of records) this.installed.set(record.id, { ...record });
    await this.init();
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    for (const id of [...this.active.keys()]) await this.deactivate(id);
    this.listeners.clear();
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
    const blueprintNodes: BlueprintNodeContribution[] = [];
    for (const [id, entry] of this.active.entries()) {
      // The install record is the authority for visibility. A lazy activation
      // or a cross-tab update can leave an entry briefly present while its
      // record has already been removed; never leak that entry to consumers.
      if (!this.isEnabled(id)) continue;
      views.push(...entry.views);
      notePanels.push(...entry.notePanels);
      noteFences.push(...entry.noteFences);
      editorActions.push(...entry.editorActions);
      blueprintNodes.push(...entry.blueprintNodes);
    }
    views.sort((a, b) => a.order - b.order);
    notePanels.sort((a, b) => a.order - b.order);
    return { views, notePanels, noteFences, editorActions, blueprintNodes };
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
    if (this.installationStorage) return this.installationStorage.load();
    // Unbound runtimes are ephemeral (used by catalog tooling and unit tests).
    // Production always supplies server-backed installationStorage.
    return this.getCatalog()
      .filter((m) => m.builtin && isRunnable(m))
      .map((m) => m.id)
      .map((id) => this.catalog.get(id))
      .filter((m): m is PluginManifest => Boolean(m) && isRunnable(m!))
      .map((m) => ({ id: m.id, enabled: true }));
  }

  private async persist(): Promise<void> {
    if (this.installationStorage) await this.installationStorage.save([...this.installed.values()]);
  }

  // ── Activation ─────────────────────────────────────────────────────────────

  /** Activate every installed + enabled plugin. Call once on boot. */
  async init(): Promise<void> {
    if (this.disposed) throw new Error('Plugin runtime is closed');
    // Manifests can gain dependencies as an installed plugin evolves. Repair
    // those graphs on startup so existing vaults receive compatible expansion
    // modules without resetting their install state or application data.
    for (const record of [...this.installed.values()]) {
      if (record.enabled) await this.ensureDependencies(record.id, new Set());
    }
    await Promise.all(
      [...this.installed.values()]
        .filter((r) => r.enabled)
        .map((r) => this.activate(r.id)),
    );
    this.emit();
  }

  private async ensureDependencies(id: string, visiting: Set<string>): Promise<void> {
    if (visiting.has(id)) throw new Error(`Circular plugin dependency involving '${id}'`);
    visiting.add(id);
    for (const depId of this.catalog.get(id)?.dependencies ?? []) {
      if (!this.installed.has(depId)) await this.install(depId);
      await this.ensureDependencies(depId, new Set(visiting));
    }
  }

  private async activate(id: string): Promise<void> {
    if (this.disposed || !this.isEnabled(id)) return;
    if (this.active.has(id)) return;
    const manifest = this.catalog.get(id);
    if (!manifest?.load) return;

    const entry: ActiveEntry = { views: [], notePanels: [], noteFences: [], editorActions: [], blueprintNodes: [] };
    const ctx: PluginContext = {
      state: () => this.state(id),
      addView: (v) => entry.views.push(v),
      addNotePanel: (p) => entry.notePanels.push(p),
      addNoteFence: (f) => entry.noteFences.push(f),
      addEditorAction: (a) => entry.editorActions.push(a),
      addBlueprintNode: (node) => entry.blueprintNodes.push(node),
    };

    let plugin: PluginModule | undefined;
    try {
      const mod = await manifest.load();
      if (this.disposed || !this.isEnabled(id)) return;
      plugin = 'default' in mod ? mod.default : mod;
      await plugin.activate(ctx);
      // Uninstall/disable may happen while the lazy module is activating. Do
      // not publish an entry after that transition, and tear down any partial
      // plugin setup the module performed.
      if (this.disposed || !this.isEnabled(id)) { await plugin.deactivate?.(); return; }
      entry.deactivate = plugin.deactivate;
      this.active.set(id, entry);
      this.errors.delete(id);
    } catch (err) {
      if (this.disposed || !this.isEnabled(id)) {
        try { await plugin?.deactivate?.(); } catch { /* teardown is best effort */ }
        return;
      }
      // Isolation: a failed activation must not break the host or other plugins.
      this.errors.set(id, err instanceof Error ? err.message : 'Activation failed');
      this.setPhase(id, 'error');
    }
  }

  private async deactivate(id: string): Promise<void> {
    this.stateHost?.revoke(id);
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
    if (this.disposed) throw new Error('Plugin runtime is closed');
    const manifest = this.catalog.get(id);
    if (!manifest) throw new Error(`Unknown plugin '${id}'`);
    if (!isRunnable(manifest)) throw new Error(`Plugin '${id}' is not installable`);
    if (this.installed.has(id)) return;

    this.setPhase(id, 'installing');
    try {
      for (const depId of manifest.dependencies ?? []) {
        if (!this.installed.has(depId)) await this.install(depId);
      }
      this.installed.set(id, { id, enabled: true });
      await this.persist();
      await this.activate(id);
      this.setPhase(id, this.errors.has(id) ? 'error' : 'idle');
    } catch (err) {
      this.installed.delete(id);
      if (!this.installationStorage) await this.persist();
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
    if (this.disposed) throw new Error('Plugin runtime is closed');
    // Clean up an active orphan too. This can occur when another tab removes
    // the installation record while a lazy activation is still settling.
    if (!this.installed.has(id) && !this.active.has(id)) return;
    const blockers = this.dependents(id);
    if (blockers.length > 0) {
      const names = blockers.map((b) => this.catalog.get(b)?.name ?? b).join(', ');
      throw new Error(`Uninstall ${names} first — ${names} depend${blockers.length > 1 ? '' : 's'} on this plugin.`);
    }
    this.setPhase(id, 'uninstalling');
    const previous = this.installed.get(id)!;
    this.installed.delete(id);
    try { await this.persist(); } catch (error) { this.installed.set(id, previous); this.setPhase(id, 'error'); throw error; }
    await this.deactivate(id);
    this.errors.delete(id);
    this.setPhase(id, 'idle');
  }

  /** Enable/disable without uninstalling (keeps the install record). */
  async setEnabled(id: string, enabled: boolean): Promise<void> {
    if (this.disposed) throw new Error('Plugin runtime is closed');
    const rec = this.installed.get(id);
    if (!rec || rec.enabled === enabled) return;
    rec.enabled = enabled;
    try { await this.persist(); } catch (error) { rec.enabled = !enabled; throw error; }
    if (enabled) await this.activate(id);
    else await this.deactivate(id);
    this.emit();
  }
}
