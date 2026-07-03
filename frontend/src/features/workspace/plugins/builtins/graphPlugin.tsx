// Knowledge Graph — contributes the interactive force-directed graph view.
import { Waypoints } from 'lucide-react';
import { GraphView } from '../../GraphView';
import type { PluginModule, WorkspaceViewProps } from '../types';

function GraphSurface(p: WorkspaceViewProps) {
  return (
    <GraphView
      notes={p.data.notes}
      links={p.graphLinks}
      selectedId={p.selectedId}
      onSelectNode={p.setSelectedId}
      onOpenNote={() => p.navigateView('notes')}
    />
  );
}

const graphPlugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'graph', label: 'Graph', icon: Waypoints, order: 50, component: GraphSurface });
  },
};

export default graphPlugin;
