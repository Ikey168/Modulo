import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { PluginModule, WorkspaceViewProps } from '../types';

export function createLifePlugin(id: string, label: string, icon: LucideIcon, order: number, section: string, component: ComponentType<WorkspaceViewProps>): PluginModule {
  return { activate(ctx) { ctx.addView({ id, label, icon, order, mode: 'life', section, component }); } };
}
