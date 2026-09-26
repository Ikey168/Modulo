import { describe, expect, it } from 'vitest';
import { CATALOG } from '../plugins/catalog';
import { activeModes, canonicalMode, hubTabs, sidebarViews } from '../plugins/modes';
import { PluginRuntime } from '../plugins/runtime';
import type { ViewContribution } from '../plugins/types';

/**
 * #490: on a phone there is no hover and usually no keyboard, so every plugin
 * view must be reachable by taps alone: the drawer lists every sidebar view and
 * hub, each hub's picker sheet lists its tabs, and a child view opens from its
 * parent. A view outside all three would only be reachable by typing its URL.
 */
function tapPath(views: ViewContribution[], view: ViewContribution, seen = new Set<string>()): string[] | undefined {
  if (seen.has(view.id)) return undefined;
  seen.add(view.id);
  if (sidebarViews(views).includes(view)) return ['drawer', view.id];
  if (view.mode) {
    const mode = canonicalMode(view.mode);
    const hubListed = activeModes(views).some(entry => entry.id === mode);
    if (hubListed && hubTabs(views, mode).includes(view)) return ['drawer', mode, 'hub picker', view.id];
  }
  const parent = view.parentViewId ? views.find(candidate => candidate.id === view.parentViewId) : undefined;
  const parentPath = parent && tapPath(views, parent, seen);
  return parentPath && [...parentPath, view.id];
}

describe('phone reachability', () => {
  it('reaches every view of the full catalog by taps from the drawer', async () => {
    const runtime = new PluginRuntime(CATALOG);
    await runtime.init();
    for (const plugin of CATALOG) await runtime.install(plugin.id);
    const views = runtime.contributions().views;
    expect(views.length).toBeGreaterThan(150);
    const unreachable = views.filter(view => !tapPath(views, view)).map(view => view.id);
    expect(unreachable).toEqual([]);
    await runtime.dispose();
  });
});
