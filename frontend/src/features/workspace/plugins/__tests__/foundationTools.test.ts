import { describe, expect, it } from 'vitest';
import {
  FOUNDATION_PLUGIN_IDS,
  FOUNDATION_TOOL_DEFINITIONS,
  HIGHEST_VALUE_FOUNDATION_PLUGIN_IDS,
  KNOWLEDGE_LEARNING_PLUGIN_IDS,
} from '../../foundationTools';
import { lifeStoreKey } from '../../lifeStore';
import { CATALOG } from '../catalog';
import type { PluginContext, ViewContribution } from '../types';

const contextFor = (views: ViewContribution[]): PluginContext => ({
  state: async () => { throw new Error("State not used by this fixture"); },
  addView: (view) => { views.push(view); },
  addNotePanel: () => undefined,
  addNoteFence: () => undefined,
  addEditorAction: () => undefined,
  addBlueprintNode: () => undefined,
});

describe('foundation and knowledge tools', () => {
  it('keeps the original groups and adds independent decision and skill plugins', () => {
    expect(HIGHEST_VALUE_FOUNDATION_PLUGIN_IDS).toHaveLength(5);
    expect(KNOWLEDGE_LEARNING_PLUGIN_IDS).toHaveLength(5);
    expect(FOUNDATION_PLUGIN_IDS).toEqual(expect.arrayContaining(['decision-journal', 'skill-tree']));
    expect(new Set(FOUNDATION_PLUGIN_IDS).size).toBe(FOUNDATION_PLUGIN_IDS.length);
    expect(new Set(FOUNDATION_TOOL_DEFINITIONS.map((tool) => lifeStoreKey(tool.config.id))).size).toBe(FOUNDATION_PLUGIN_IDS.length);
  });

  it('loads every tool into its intended hub with a working collection config', async () => {
    for (const definition of FOUNDATION_TOOL_DEFINITIONS) {
      const manifest = CATALOG.find((plugin) => plugin.id === definition.pluginId);
      expect(manifest?.load, definition.pluginId).toBeTypeOf('function');
      expect(definition.config.fields.length).toBeGreaterThan(0);
      expect(definition.config.statuses.length).toBeGreaterThan(1);

      const views: ViewContribution[] = [];
      const loaded = await manifest!.load!();
      const plugin = 'default' in loaded ? loaded.default : loaded;
      await plugin.activate(contextFor(views));
      expect(views).toEqual([expect.objectContaining({
        id: definition.pluginId,
        label: definition.label,
        // The Decision Journal lives in the Research hub's Decision Support section.
        mode: definition.pluginId === 'decision-journal' ? 'research' : definition.mode,
        section: definition.pluginId === 'decision-journal' ? 'Decision Support' : definition.section,
      })]);
    }
  });
});
