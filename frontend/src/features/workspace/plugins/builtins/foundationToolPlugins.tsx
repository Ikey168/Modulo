import { foundationToolDefinition } from '../../foundationTools';
import { FoundationToolView } from '../../FoundationToolView';
import type { PluginModule, WorkspaceViewProps } from '../types';

/** Lazy factory for the small, independent foundation tools. Each tool owns a
 * versioned local collection through LifeCollectionView; the shared component
 * only supplies interaction patterns and does not merge their stores. */
export function foundationToolPlugin(pluginId: string): PluginModule {
  const definition = foundationToolDefinition(pluginId);
  if (!definition) throw new Error(`Unknown foundation tool: ${pluginId}`);
  const view = (workspace: WorkspaceViewProps) => <FoundationToolView definition={definition} workspace={workspace} />;

  return {
    activate(ctx) {
      ctx.addView({
        id: definition.pluginId,
        label: definition.label,
        icon: definition.icon,
        order: definition.order,
        mode: definition.mode,
        section: definition.section,
        component: view,
      });
    },
  };
}
