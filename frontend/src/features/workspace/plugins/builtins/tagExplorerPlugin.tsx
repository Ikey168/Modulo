// Tag Explorer - contributes a nested tag tree that filters notes by tag.
// Installable (not pre-installed); lazy-loaded.
import { Tags } from 'lucide-react';
import { TagExplorerView } from '../../TagExplorerView';
import type { PluginModule, WorkspaceViewProps } from '../types';

function TagExplorerSurface(p: WorkspaceViewProps) {
  return <TagExplorerView notes={p.data.notes} onOpenNote={p.onOpenNote} />;
}

const tagExplorerPlugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'tags', label: 'Tags', icon: Tags, order: 90, component: TagExplorerSurface });
  },
};

export default tagExplorerPlugin;
