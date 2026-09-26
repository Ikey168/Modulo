import { SelfHostedToolView } from '../../SelfHostedToolView';
import { selfHostedToolDefinition } from '../../selfHostedTools';
import type { PluginModule } from '../types';

export function selfHostedToolPlugin(pluginId: string): PluginModule {
  const definition = selfHostedToolDefinition(pluginId);
  if (!definition) throw new Error(`Unknown self-hosted tool: ${pluginId}`);
  const view = () => <SelfHostedToolView definition={definition} />;
  return {
    activate(ctx) {
      ctx.addView({ id: definition.pluginId, label: definition.label, icon: definition.icon, order: definition.order, mode: definition.mode, section: definition.section, component: view });
    },
  };
}
