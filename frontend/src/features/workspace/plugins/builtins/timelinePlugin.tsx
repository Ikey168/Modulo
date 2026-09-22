/* eslint-disable react-refresh/only-export-components -- lazy plugin module exports a descriptor beside its private React surface */
// Timeline - contributes a chronological stream of notes grouped by period.
// Installable (not pre-installed); lazy-loaded.
import { History } from 'lucide-react';
import { TimelineView } from '../../TimelineView';
import type { PluginModule, WorkspaceViewProps } from '../types';

function TimelineSurface(p: WorkspaceViewProps) {
  return <TimelineView notes={p.data.notes} tags={p.data.tags} loading={p.data.loading} onOpenNote={p.onOpenNote} />;
}

const timelinePlugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'timeline', label: 'Timeline', icon: History, order: 40, mode: 'knowledge', section: 'Explore', component: TimelineSurface });
  },
};

export default timelinePlugin;
