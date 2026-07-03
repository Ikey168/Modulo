import { beforeEach, describe, expect, it } from 'vitest';
import { PluginRuntime } from '../runtime';
import type { PluginManifest, PluginModule } from '../types';

// A trivial module that contributes one view named after the plugin, so we can
// observe activation through `contributions().views`.
const NOOP = (() => null) as unknown as never;
function viewModule(id: string): PluginModule {
  return {
    activate: (ctx) => ctx.addView({ id, label: id, icon: NOOP, order: 0, component: NOOP }),
  };
}

/** Builds a fresh catalog and a per-id counter of how many times `load` ran. */
function makeCatalog() {
  const loads: Record<string, number> = {};
  const mk = (id: string, opts: Partial<PluginManifest> = {}, mod?: PluginModule): PluginManifest => ({
    id,
    name: id,
    version: '1.0.0',
    author: 'test',
    description: '',
    category: 'test',
    icon: 'x',
    load: () => {
      loads[id] = (loads[id] ?? 0) + 1;
      return Promise.resolve({ default: mod ?? viewModule(id) });
    },
    ...opts,
  });
  const catalog: PluginManifest[] = [
    mk('notes', { builtin: true }),
    mk('graph', { builtin: true }),
    mk('outline', { dependencies: ['notes'] }),
    mk('coming-soon', { load: undefined }),
    mk('broken', {}, { activate: () => { throw new Error('boom'); } }),
  ];
  return { catalog, loads };
}

beforeEach(() => localStorage.clear());

describe('PluginRuntime — install state', () => {
  it('seeds built-in defaults on a fresh vault', () => {
    const { catalog } = makeCatalog();
    const rt = new PluginRuntime(catalog);
    expect(rt.isInstalled('notes')).toBe(true);
    expect(rt.isInstalled('graph')).toBe(true);
    expect(rt.isInstalled('outline')).toBe(false);
  });

  it('migrates the legacy flat id list, dropping non-runnable ids', () => {
    localStorage.setItem('modulo-plugins', JSON.stringify(['graph', 'coming-soon']));
    const { catalog } = makeCatalog();
    const rt = new PluginRuntime(catalog);
    expect(rt.isInstalled('graph')).toBe(true);
    expect(rt.isInstalled('coming-soon')).toBe(false); // metadata-only → not installable
    expect(rt.isInstalled('notes')).toBe(false); // not in the legacy list
  });

  it('persists installs across runtime instances', async () => {
    const { catalog } = makeCatalog();
    const rt1 = new PluginRuntime(catalog);
    await rt1.init();
    await rt1.install('outline');
    const rt2 = new PluginRuntime(catalog);
    expect(rt2.isInstalled('outline')).toBe(true);
    expect(rt2.isInstalled('notes')).toBe(true);
  });
});

describe('PluginRuntime — activation & isolation', () => {
  it('activates installed plugins and aggregates their contributions', async () => {
    const { catalog } = makeCatalog();
    const rt = new PluginRuntime(catalog);
    await rt.init();
    expect(rt.contributions().views.map((v) => v.id).sort()).toEqual(['graph', 'notes']);
  });

  it('never loads the code of a not-installed plugin', async () => {
    const { catalog, loads } = makeCatalog();
    const rt = new PluginRuntime(catalog);
    await rt.init();
    expect(loads.outline).toBeUndefined(); // never installed → never fetched
    expect(loads.notes).toBe(1); // built-in → activated exactly once
  });

  it('isolates a plugin that throws on activation', async () => {
    const { catalog } = makeCatalog();
    const rt = new PluginRuntime(catalog);
    await rt.init();
    await rt.install('broken');
    expect(rt.errorOf('broken')).toBeTruthy();
    expect(rt.isActive('broken')).toBe(false);
    // The other plugins keep working.
    expect(rt.contributions().views.map((v) => v.id).sort()).toEqual(['graph', 'notes']);
  });
});

describe('PluginRuntime — lifecycle', () => {
  it('install adds the contribution', async () => {
    const { catalog } = makeCatalog();
    const rt = new PluginRuntime(catalog);
    await rt.init();
    await rt.install('outline');
    expect(rt.contributions().views.map((v) => v.id)).toContain('outline');
  });

  it('install resolves dependencies first', async () => {
    const { catalog } = makeCatalog();
    const rt = new PluginRuntime(catalog);
    await rt.init();
    await rt.uninstall('notes'); // allowed — nothing depends on it yet
    expect(rt.isInstalled('notes')).toBe(false);
    await rt.install('outline'); // depends on notes
    expect(rt.isInstalled('notes')).toBe(true);
    expect(rt.isInstalled('outline')).toBe(true);
  });

  it('uninstall is refused while a dependent is installed', async () => {
    const { catalog } = makeCatalog();
    const rt = new PluginRuntime(catalog);
    await rt.init();
    await rt.install('outline');
    await expect(rt.uninstall('notes')).rejects.toThrow();
    expect(rt.isInstalled('notes')).toBe(true);
  });

  it('uninstall removes the contribution', async () => {
    const { catalog } = makeCatalog();
    const rt = new PluginRuntime(catalog);
    await rt.init();
    expect(rt.contributions().views.map((v) => v.id)).toContain('graph');
    await rt.uninstall('graph');
    expect(rt.contributions().views.map((v) => v.id)).not.toContain('graph');
    expect(rt.isInstalled('graph')).toBe(false);
  });

  it('enable/disable toggles activation without uninstalling', async () => {
    const { catalog } = makeCatalog();
    const rt = new PluginRuntime(catalog);
    await rt.init();
    await rt.setEnabled('graph', false);
    expect(rt.isInstalled('graph')).toBe(true);
    expect(rt.isActive('graph')).toBe(false);
    expect(rt.contributions().views.map((v) => v.id)).not.toContain('graph');
    await rt.setEnabled('graph', true);
    expect(rt.isActive('graph')).toBe(true);
    expect(rt.contributions().views.map((v) => v.id)).toContain('graph');
  });

  it('rejects installing a metadata-only ("coming soon") entry', async () => {
    const { catalog } = makeCatalog();
    const rt = new PluginRuntime(catalog);
    await expect(rt.install('coming-soon')).rejects.toThrow();
    expect(rt.isInstalled('coming-soon')).toBe(false);
  });
});
