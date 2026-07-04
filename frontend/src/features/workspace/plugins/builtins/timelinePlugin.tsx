// Timeline - contributes a chronological stream of notes grouped by period.
// Installable (not pre-installed); lazy-loaded.
import { History } from 'lucide-react';
import { TimelineView } from '../../TimelineView';
import type { PluginModule, WorkspaceViewProps } from '../types';

function TimelineSurface(p: WorkspaceViewProps) {
  return <TimelineView notes={p.data.notes} tags={p.data.tags} onOpenNote={p.onOpenNote} />;
}

const timelinePlugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'timeline', label: 'Timeline', icon: History, order: 80, component: TimelineSurface });
  },
};

export default timelinePlugin;
