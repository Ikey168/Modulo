import DecisionJournalView from '../../workspaceTools/DecisionJournalView';
import { SkillTreeView } from '../../LearningPluginViews';
import { DECISION_JOURNAL_PLUGIN_ID, SKILL_TREE_PLUGIN_ID, foundationToolDefinition } from '../../foundationTools';
import type { PluginModule } from '../types';

export function learningPlugin(id: string): PluginModule {
  const definition = foundationToolDefinition(id);
  if (!definition || ![DECISION_JOURNAL_PLUGIN_ID, SKILL_TREE_PLUGIN_ID].includes(id)) throw new Error(`Unknown learning plugin: ${id}`);
  return { activate(ctx) {
    ctx.addView({ id, label: definition.label, icon: definition.icon, order: definition.order, mode: id === DECISION_JOURNAL_PLUGIN_ID ? 'research' : definition.mode, section: id === DECISION_JOURNAL_PLUGIN_ID ? 'Decision Support' : definition.section,
      component: id === DECISION_JOURNAL_PLUGIN_ID ? DecisionJournalView : SkillTreeView });
  } };
}
