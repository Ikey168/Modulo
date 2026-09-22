import { writeFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import type { PluginContext, PluginModule } from '../src/features/workspace/plugins/types';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://inventory.invalid/' });
for (const name of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'HTMLElement',
  'Element', 'Node', 'Event', 'CustomEvent', 'MutationObserver'] as const) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
const { CATALOG } = await import('../src/features/workspace/plugins/catalog');

const entries = [];
for (const plugin of CATALOG) {
  const contributionIds = { views: [] as string[], notePanels: [] as string[], noteFences: [] as string[],
    editorActions: [] as string[], blueprintNodes: [] as string[] };
  let inventoryError: string | undefined;
  if (plugin.load) {
    try {
      const loaded = await plugin.load();
      const module: PluginModule = 'default' in loaded ? loaded.default : loaded;
      const ctx: PluginContext = {
        state: async () => { throw new Error('State is unavailable during catalog inventory'); },
        addView: item => { contributionIds.views.push(item.id); },
        addNotePanel: item => { contributionIds.notePanels.push(item.id); },
        addNoteFence: item => { contributionIds.noteFences.push(item.language); },
        addEditorAction: item => { contributionIds.editorActions.push(item.id); },
        addBlueprintNode: item => { contributionIds.blueprintNodes.push(item.type); },
      };
      await module.activate(ctx);
    } catch (error) { inventoryError = String(error); }
  }
  entries.push({ id: plugin.id, name: plugin.name, category: plugin.category,
    builtin: plugin.builtin === true, runnable: typeof plugin.load === 'function',
    dependencies: plugin.dependencies ?? [], contributionIds, ...(inventoryError ? { inventoryError } : {}) });
}
entries.sort((a, b) => a.id.localeCompare(b.id));
const output = process.argv[2];
const inventory = { count: entries.length, runnable: entries.filter((entry) => entry.runnable).length,
  contributionTotals: {
    views: entries.reduce((total, entry) => total + entry.contributionIds.views.length, 0),
    notePanels: entries.reduce((total, entry) => total + entry.contributionIds.notePanels.length, 0),
    noteFences: entries.reduce((total, entry) => total + entry.contributionIds.noteFences.length, 0),
    editorActions: entries.reduce((total, entry) => total + entry.contributionIds.editorActions.length, 0),
    blueprintNodes: entries.reduce((total, entry) => total + entry.contributionIds.blueprintNodes.length, 0),
  }, entries };
if (output) writeFileSync(output, JSON.stringify(inventory, null, 2) + '\n');
else process.stdout.write(JSON.stringify({ count: inventory.count, runnable: inventory.runnable,
  contributionTotals: inventory.contributionTotals }));
if (entries.some((entry) => entry.inventoryError)) process.exitCode = 1;
