import { AttachmentTextPanel } from '../../AttachmentTextPanel';
import { RecordBacklinksPanel } from '../../RecordBacklinksPanel';
/* eslint-disable react-refresh/only-export-components -- lazy plugin module exports a descriptor beside its private React surface */
// Markdown Notes — contributes the primary notes view. Lazy-loaded, so the
// (large) NotesView tree only enters the bundle once this plugin is installed.
import { FileText } from 'lucide-react';
import { NotesView } from '../../NotesView';
import { NOTES_NODES } from '../../../blueprint/nodeCatalog';
import type { PluginModule, WorkspaceViewProps } from '../types';

function NotesSurface(p: WorkspaceViewProps) {
  return (
    <NotesView
      data={p.data}
      selectedId={p.selectedId}
      onSelect={p.onOpenNote}
      editMode={p.editMode}
      onToggleEdit={p.setEditMode}
      searchQuery={p.searchQuery}
      onSearch={p.setSearchQuery}
      onNewNote={p.onNewNote}
      onClearSelection={() => p.setSelectedId(null)}
      notePanels={p.contributions.notePanels}
      noteFences={p.contributions.noteFences}
      editorActions={p.contributions.editorActions}
    />
  );
}

const notesPlugin: PluginModule = {
  activate(ctx) {
    ctx.addNotePanel({ id: 'attachment-text', title: 'Document text', order: 22, component: AttachmentTextPanel });
    ctx.addNotePanel({ id: 'record-backlinks', title: 'Referenced by', order: 21, component: RecordBacklinksPanel });
    ctx.addView({ id: 'notes', label: 'Notes', icon: FileText, order: 10, mode: 'knowledge-tools', section: 'Notes', component: NotesSurface });
    // Contribute the note-related blueprint nodes to the editor palette.
    for (const node of NOTES_NODES) ctx.addBlueprintNode(node);
  },
};

export default notesPlugin;
