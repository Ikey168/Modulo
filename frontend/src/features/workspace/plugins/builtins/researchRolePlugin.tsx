import { RESEARCH_ROLES } from '../../researchRoles';
import * as views from '../../ResearchWorkflowViews';
import type { PluginModule } from '../types';

export function researchRolePlugin(id: string): PluginModule {
  const role = RESEARCH_ROLES.find(role => role.id === id);
  if (!role) throw new Error(`Unknown research tool: ${id}`);
  return { activate(ctx) {
    ctx.addView({ id: role.viewId, label: role.name, icon: role.icon, order: 30,
      mode: 'research', section: role.stage, component: views[role.component] });
  } };
}
