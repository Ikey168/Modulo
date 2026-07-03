// Markdown Notes — contributes the primary notes view. Lazy-loaded, so the
// (large) NotesView tree only enters the bundle once this plugin is installed.
import { FileText } from 'lucide-react';
import { NotesView } from '../../NotesView';
import type { PluginModule, WorkspaceViewProps } from '../types';

function NotesSurface(p: WorkspaceViewProps) {
  return (
    <NotesView
      data={p.data}
      selectedId={p.selectedId}
      onSelect={p.setSelectedId}
      editMode={p.editMode}
      onToggleEdit={p.setEditMode}
      searchQuery={p.searchQuery}
      onSearch={p.setSearchQuery}
      onNewNote={p.onNewNote}
      notePanels={p.contributions.notePanels}
      noteFences={p.contributions.noteFences}
      editorActions={p.contributions.editorActions}
    />
  );
}

const notesPlugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'notes', label: 'Notes', icon: FileText, order: 40, component: NotesSurface });
  },
};

export default notesPlugin;
