import type { PluginModule, WorkspaceViewProps } from '../plugins/types';
import type { ComponentType } from 'react';
import { WORKSPACE_TOOLS, type WorkspaceToolId } from './definitions';

const loaders: Record<WorkspaceToolId, () => Promise<{ default: ComponentType<WorkspaceViewProps> }>> = {
  'project-workspaces': () => import('./ProjectsView'),
  'executable-runbooks': () => import('./RunbooksView'),
  'universal-inbox': () => import('./InboxView'),
  'workspace-time-machine': () => import('./TimeMachineView'),
  'local-folder-bridge': () => import('./FolderBridgeView'),
  'workspace-briefings': () => import('./BriefingsView'),
  'living-documents': () => import('./LivingDocumentsView'),
  'workspace-capsules': () => import('./CapsulesView'),
};
export async function workspaceToolPlugin(id: WorkspaceToolId): Promise<PluginModule> {
  const definition = WORKSPACE_TOOLS.find(tool => tool.id === id)!;
  const view = await loaders[id]();
  const membership = id === 'project-workspaces' ? await import('./ProjectMembershipPanel') : undefined;
  const living = id === 'living-documents' ? await import('./LivingDocumentsView') : undefined;
  return { activate(ctx) {
    ctx.addView({ id, label: definition.name, icon: definition.icon, order: 100 + WORKSPACE_TOOLS.findIndex(tool => tool.id === id), mode: ['executable-runbooks', 'living-documents'].includes(id) ? 'externalization' : id === 'universal-inbox' ? 'reading-capture' : ['workspace-time-machine', 'workspace-briefings'].includes(id) ? 'maintenance' : 'productivity', section: ['executable-runbooks', 'living-documents'].includes(id) ? 'Externalization' : id === 'universal-inbox' ? 'Awareness' : ['workspace-time-machine', 'workspace-briefings'].includes(id) ? 'Maintenance' : 'Workspace', component: view.default });
    if (membership) ctx.addNotePanel({ id: 'project-membership', title: 'Projects', order: 20, component: membership.default });
    if (living) {
      ctx.addNoteFence({ language: 'living-query', component: living.LivingQuery });
      ctx.addNoteFence({ language: 'living-note', component: living.LivingNote });
    }
    if (id === 'executable-runbooks') ctx.addEditorAction({ id: 'insert-runbook', label: 'Insert runbook checklist', icon: definition.icon,
      run: editor => editor.insertAtCursor('- [ ] Prepare and inspect inputs\n- [ ] Perform the action\n- [ ] Verify the result and record evidence\n') });
  } };
}
