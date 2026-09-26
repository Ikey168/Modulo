import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog';
import { PACKS } from '../packs';
import { SELF_HOSTED_PLUGIN_IDS, SELF_HOSTED_TOOL_DEFINITIONS } from '../../selfHostedTools';
import { isRunnable, type PluginContext, type ViewContribution } from '../types';

describe('self-hosted essentials', () => {
  it('provides eight independent, versioned tools in one pack', () => {
    expect(SELF_HOSTED_TOOL_DEFINITIONS).toHaveLength(8);
    expect(new Set(SELF_HOSTED_PLUGIN_IDS).size).toBe(8);
    expect(PACKS.find((pack) => pack.id === 'pack-self-hosted-essentials')?.pluginIds).toEqual(SELF_HOSTED_PLUGIN_IDS);
    for (const definition of SELF_HOSTED_TOOL_DEFINITIONS) {
      expect(definition.config.id).toBe(definition.pluginId);
      expect(definition.config.fields.length).toBeGreaterThan(3);
    }
  });

  it('registers every tool as a lazy runnable workspace view', async () => {
    for (const definition of SELF_HOSTED_TOOL_DEFINITIONS) {
      const manifest = CATALOG.find((item) => item.id === definition.pluginId);
      expect(manifest && isRunnable(manifest), definition.pluginId).toBe(true);
      const views: ViewContribution[] = [];
      const context: PluginContext = {
        state: async () => { throw new Error("State not used by this fixture"); },
        addView: (view) => { views.push(view); }, addNotePanel: () => undefined, addNoteFence: () => undefined,
        addEditorAction: () => undefined, addBlueprintNode: () => undefined,
      };
      const loaded = await manifest!.load!();
      const plugin = 'default' in loaded ? loaded.default : loaded;
      plugin.activate(context);
      expect(views[0]).toMatchObject({ id: definition.pluginId, label: definition.label, mode: definition.mode, section: definition.section });
    }
  });
});
