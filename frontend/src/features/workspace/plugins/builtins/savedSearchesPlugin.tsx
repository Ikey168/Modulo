// Saved Searches - contributes named smart folders evaluated live over notes.
// Installable (not pre-installed); lazy-loaded.
import { FolderSearch } from 'lucide-react';
import { SavedSearchesView } from '../../SavedSearchesView';
import type { PluginModule, WorkspaceViewProps } from '../types';

function SavedSearchesSurface(p: WorkspaceViewProps) {
  return <SavedSearchesView notes={p.data.notes} onOpenNote={p.onOpenNote} />;
}

const savedSearchesPlugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'saved-searches', label: 'Saved Searches', icon: FolderSearch, order: 100, component: SavedSearchesSurface });
  },
};

export default savedSearchesPlugin;
