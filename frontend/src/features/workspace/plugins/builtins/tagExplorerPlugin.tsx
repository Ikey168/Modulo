/* eslint-disable react-refresh/only-export-components -- lazy plugin module exports a descriptor beside its private React surface */
// Tag Explorer - contributes a nested tag tree that filters notes by tag.
// Installable (not pre-installed); lazy-loaded.
import { Tags } from 'lucide-react';
import { TagExplorerView } from '../../TagExplorerView';
import type { PluginModule, WorkspaceViewProps } from '../types';

function TagExplorerSurface(p: WorkspaceViewProps) {
  return <TagExplorerView notes={p.data.notes} tags={p.data.tags} onOpenNote={p.onOpenNote} />;
}

const tagExplorerPlugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'tags', label: 'Tags', icon: Tags, order: 50, mode: 'knowledge-tools', section: 'Organize', component: TagExplorerSurface });
  },
};

export default tagExplorerPlugin;
