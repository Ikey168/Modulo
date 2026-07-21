// Engagement pipeline (#361) — implements the `kanban` marketplace entry as a
// drag-and-drop board of engagement notes moving through configurable stages
// (default: the audit pipeline). A tab in the Audit hub.
import { SquareKanban } from 'lucide-react';
import { PipelineView } from '../../PipelineView';
import type { PluginModule, WorkspaceViewProps } from '../types';

function PipelineSurface(p: WorkspaceViewProps) {
  return <PipelineView {...p} />;
}

const kanbanPlugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'pipeline', label: 'Pipeline', icon: SquareKanban, order: 50, mode: 'audit', component: PipelineSurface });
  },
};

export default kanbanPlugin;
