import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CoreNote } from '@modulo/core';
import { Hover } from './atoms';
import { Markdown } from './Markdown';
import type { WorkspaceData } from './useCoreWorkspace';

function isAnchored(note: CoreNote): boolean {
  return Boolean(note.isOnBlockchain || note.isDecentralized);
}

function anchorRef(note: CoreNote): string | null {
  if (note.blockchainTxHash) return `tx: ${note.blockchainTxHash.slice(0, 8)}…`;
  if (note.ipfsCid) return `cid: ${note.ipfsCid.slice(0, 8)}…`;
  return null;
}

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface NotesViewProps {
  data: WorkspaceData;
  selectedId: number | null;
  onSelect: (id: number) => void;
  editMode: boolean;
  onToggleEdit: (v: boolean) => void;
  searchQuery: string;
  onSearch: (q: string) => void;
  onNewNote: () => void;
}

export function NotesView({
  data,
  selectedId,
  onSelect,
  editMode,
  onToggleEdit,
  searchQuery,
  onSearch,
  onNewNote,
}: NotesViewProps) {
  const { notes, links, updateNote, deleteNote, anchorNote, addTag, removeTag, createLink } = data;
  const note = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? notes[0] ?? null,
    [notes, selectedId],
  );

  const sq = searchQuery.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!sq) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(sq) ||
        (n.tags ?? []).some((t) => t.name.toLowerCase().includes(sq)),
    );
  }, [notes, sq]);

  // Outgoing / incoming derived from the global link set.
  const outgoing = useMemo(() => {
    if (!note) return [];
    return links
      .filter((l) => l.sourceNoteId === note.id)
      .map((l) => notes.find((n) => n.id === l.targetNoteId))
      .filter((n): n is CoreNote => Boolean(n));
  }, [links, notes, note]);

  const backlinks = useMemo(() => {
    if (!note) return [];
    return links
      .filter((l) => l.targetNoteId === note.id)
      .map((l) => notes.find((n) => n.id === l.sourceNoteId))
      .filter((n): n is CoreNote => Boolean(n));
  }, [links, notes, note]);

  if (!note) {
    return (
      <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
        <NoteListColumn
          notes={filtered}
          selectedId={selectedId}
          searchQuery={searchQuery}
          onSearch={onSearch}
          onNewNote={onNewNote}
          onSelect={onSelect}
        />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#52525b', fontSize: 13 }}>
          {data.loading ? 'Loading notes…' : 'No notes yet — create one to get started.'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden', animation: 'fadeIn .12s ease' }}>
      <NoteListColumn
        notes={filtered}
        selectedId={note.id}
        searchQuery={searchQuery}
        onSearch={onSearch}
        onNewNote={onNewNote}
        onSelect={onSelect}
      />

      <Editor
        key={note.id}
        note={note}
        editMode={editMode}
        onToggleEdit={onToggleEdit}
        onSave={(title, content) => updateNote(note.id, { title, content, markdownContent: content })}
        onSelectNote={onSelect}
        allNotes={notes}
      />

      <InfoPanel
        note={note}
        outgoing={outgoing}
        backlinks={backlinks}
        allNotes={notes}
        onSelect={onSelect}
        onAnchor={() => anchorNote(note.id)}
        onAddTag={(name) => addTag(note.id, name)}
        onRemoveTag={(tagId) => removeTag(note.id, tagId)}
        onCreateLink={(targetId) => createLink(note.id, targetId)}
        onDelete={() => deleteNote(note.id)}
      />
    </div>
  );
}

// ── Note list column ───────────────────────────────────────────────────────

interface NoteListColumnProps {
  notes: CoreNote[];
  selectedId: number | null;
  searchQuery: string;
  onSearch: (q: string) => void;
  onNewNote: () => void;
  onSelect: (id: number) => void;
}

function NoteListColumn({ notes, selectedId, searchQuery, onSearch, onNewNote, onSelect }: NoteListColumnProps) {
  return (
    <div
      style={{
        width: 252,
        flexShrink: 0,
        borderRight: '1px solid #1e1e24',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#0e0e12',
      }}
    >
      <div style={{ padding: '14px 13px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#52525b' }}>Notes</span>
        <Hover
          onClick={onNewNote}
          title="New note"
          style={{ width: 22, height: 22, borderRadius: 5, background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'background .1s' }}
          hoverStyle={{ background: '#4338ca' }}
        >
          <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="white" strokeWidth={1.6} strokeLinecap="round" />
          </svg>
        </Hover>
      </div>

      <div style={{ padding: '0 10px 8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#16161a', border: '1px solid #2a2a30', borderRadius: 6, padding: '6px 9px' }}>
          <svg width={12} height={12} viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
            <circle cx={5} cy={5} r={3.5} stroke="#52525b" strokeWidth={1.2} />
            <path d="M8 8l2.5 2.5" stroke="#52525b" strokeWidth={1.2} strokeLinecap="round" />
          </svg>
          <input
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Filter notes…"
            style={{ background: 'none', border: 'none', outline: 'none', color: '#a1a1aa', fontSize: 12.5, fontFamily: "'DM Sans',sans-serif", width: '100%' }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {notes.map((n) => (
          <FlatNoteItem key={n.id} note={n} selected={n.id === selectedId} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function FlatNoteItem({ note, selected, onSelect }: { note: CoreNote; selected: boolean; onSelect: (id: number) => void }) {
  const [h, setH] = useState(false);
  return (
    <div
      onClick={() => onSelect(note.id)}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        padding: '7px 9px',
        borderRadius: 6,
        cursor: 'pointer',
        marginBottom: 2,
        background: selected ? '#1c1c22' : h ? 'rgba(255,255,255,.02)' : 'transparent',
        borderLeft: `2px solid ${selected ? '#4f46e5' : 'transparent'}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: selected ? 500 : 400, color: selected ? '#e4e4e7' : '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {note.title}
        </span>
        {isAnchored(note) && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />}
      </div>
      <div style={{ fontSize: 11, color: '#3f3f46', marginTop: 2, paddingLeft: 2 }}>{relativeTime(note.updatedAt)}</div>
    </div>
  );
}

// ── Editor ───────────────────────────────────────────────────────────────────

interface EditorProps {
  note: CoreNote;
  editMode: boolean;
  onToggleEdit: (v: boolean) => void;
  onSave: (title: string, content: string) => void;
  onSelectNote: (id: number) => void;
  allNotes: CoreNote[];
}

function Editor({ note, editMode, onToggleEdit, onSave, onSelectNote, allNotes }: EditorProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.markdownContent ?? note.content ?? '');
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (dirtyRef.current) {
      dirtyRef.current = false;
      onSave(title.trim() || 'Untitled Note', content);
    }
  };

  // Debounced autosave whenever title/content change.
  useEffect(() => {
    if (!dirtyRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      dirtyRef.current = false;
      onSave(title.trim() || 'Untitled Note', content);
    }, 900);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      <div style={{ padding: '0 20px', height: 46, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e1e24', flexShrink: 0, background: '#0e0e12', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#f4f4f5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title || 'Untitled Note'}
          </span>
          {isAnchored(note) && (
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.06em', color: '#22c55e', background: 'rgba(34,197,94,.1)', padding: '2px 8px', borderRadius: 10, border: '1px solid rgba(34,197,94,.2)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              ON-CHAIN
            </span>
          )}
        </div>
        <div style={{ display: 'flex', background: '#16161a', border: '1px solid #2a2a30', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
          {(['Edit', 'Preview'] as const).map((lbl, i) => {
            const active = (i === 0) === editMode;
            return (
              <div
                key={lbl}
                onClick={() => {
                  const goingToPreview = lbl === 'Preview';
                  if (goingToPreview) flush();
                  onToggleEdit(lbl === 'Edit');
                }}
                style={{ padding: '4px 13px', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: active ? '#4f46e5' : 'transparent', color: active ? '#fff' : '#71717a', transition: 'background .1s' }}
              >
                {lbl}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {editMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <input
              value={title}
              onChange={(e) => {
                dirtyRef.current = true;
                setTitle(e.target.value);
              }}
              onBlur={flush}
              placeholder="Note title"
              style={{ background: '#0a0a0b', color: '#f4f4f5', border: 'none', borderBottom: '1px solid #1e1e24', outline: 'none', padding: '18px 40px 14px', fontSize: 18, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}
            />
            <textarea
              value={content}
              onChange={(e) => {
                dirtyRef.current = true;
                setContent(e.target.value);
              }}
              onBlur={flush}
              style={{ flex: 1, width: '100%', boxSizing: 'border-box', background: '#0a0a0b', color: '#d4d4d8', border: 'none', outline: 'none', resize: 'none', padding: '20px 40px', fontSize: 14, lineHeight: 1.8, fontFamily: "'DM Mono',monospace", tabSize: 2 }}
            />
          </div>
        ) : (
          <div style={{ padding: '32px 40px', height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
            <Markdown content={content} notes={allNotes} onSelectNote={onSelectNote} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Info panel ─────────────────────────────────────────────────────────────

interface InfoPanelProps {
  note: CoreNote;
  outgoing: CoreNote[];
  backlinks: CoreNote[];
  allNotes: CoreNote[];
  onSelect: (id: number) => void;
  onAnchor: () => void;
  onAddTag: (name: string) => void;
  onRemoveTag: (tagId: string) => void;
  onCreateLink: (targetId: number) => void;
  onDelete: () => void;
}

function InfoPanel({ note, outgoing, backlinks, allNotes, onSelect, onAnchor, onAddTag, onRemoveTag, onCreateLink, onDelete }: InfoPanelProps) {
  const [tagDraft, setTagDraft] = useState('');
  const linkableNotes = allNotes.filter(
    (n) => n.id !== note.id && !outgoing.some((o) => o.id === n.id),
  );

  return (
    <div style={{ width: 240, flexShrink: 0, borderLeft: '1px solid #1e1e24', overflowY: 'auto', background: '#0e0e12', display: 'flex', flexDirection: 'column' }}>
      <InfoSection title="Tags" topPad={18}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
          {(note.tags ?? []).map((tag) => (
            <span key={tag.id} style={{ fontSize: 11.5, color: '#818cf8', background: 'rgba(79,70,229,.1)', padding: '2px 6px 2px 9px', borderRadius: 10, border: '1px solid rgba(79,70,229,.2)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {tag.name}
              <span onClick={() => onRemoveTag(tag.id)} style={{ cursor: 'pointer', color: '#52525b', fontSize: 13, lineHeight: 1 }} title="Remove tag">
                ×
              </span>
            </span>
          ))}
          {(note.tags ?? []).length === 0 && <span style={{ fontSize: 12, color: '#3f3f46' }}>—</span>}
        </div>
        <input
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && tagDraft.trim()) {
              onAddTag(tagDraft.trim());
              setTagDraft('');
            }
          }}
          placeholder="Add tag…"
          style={{ width: '100%', boxSizing: 'border-box', background: '#16161a', border: '1px solid #2a2a30', borderRadius: 6, padding: '5px 9px', color: '#a1a1aa', fontSize: 12, outline: 'none', fontFamily: "'DM Sans',sans-serif" }}
        />
      </InfoSection>

      <InfoSection title="Links to">
        {outgoing.length === 0 ? (
          <span style={{ fontSize: 12, color: '#3f3f46', padding: '4px 2px' }}>—</span>
        ) : (
          outgoing.map((n) => <LinkItem key={n.id} note={n} dir="out" onSelect={onSelect} />)
        )}
        {linkableNotes.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              const id = Number(e.target.value);
              if (id) onCreateLink(id);
            }}
            style={{ marginTop: 6, width: '100%', boxSizing: 'border-box', background: '#16161a', border: '1px solid #2a2a30', borderRadius: 6, padding: '5px 9px', color: '#71717a', fontSize: 12, outline: 'none' }}
          >
            <option value="">+ Link to note…</option>
            {linkableNotes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
        )}
      </InfoSection>

      <InfoSection title="Backlinks">
        {backlinks.length === 0 ? (
          <span style={{ fontSize: 12, color: '#3f3f46', padding: '4px 2px' }}>—</span>
        ) : (
          backlinks.map((n) => <LinkItem key={n.id} note={n} dir="in" onSelect={onSelect} />)
        )}
      </InfoSection>

      <div style={{ padding: '16px 16px 20px' }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#52525b', marginBottom: 10 }}>On-Chain</div>
        {isAnchored(note) ? (
          <div style={{ padding: '11px 13px', background: 'rgba(34,197,94,.05)', border: '1px solid rgba(34,197,94,.15)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 600, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width={11} height={11} viewBox="0 0 11 11" fill="none">
                <path d="M2 5.5l2.5 2.5L9 3" stroke="#22c55e" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Anchored
            </div>
            <div style={{ fontSize: 10.5, color: '#3f3f46', fontFamily: "'DM Mono',monospace", wordBreak: 'break-all', lineHeight: 1.6 }}>
              {anchorRef(note) ?? 'recorded'}
            </div>
          </div>
        ) : (
          <Hover
            onClick={onAnchor}
            style={{ padding: '9px 13px', background: '#16161a', border: '1px solid #2a2a30', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#71717a', display: 'flex', alignItems: 'center', gap: 7, transition: 'border-color .15s, color .15s' }}
            hoverStyle={{ borderColor: '#52525b', color: '#a1a1aa' }}
          >
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
              <path d="M6 1.5v5" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" />
              <path d="M3.5 4L6 1.5 8.5 4" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
              <path d="M1.5 8.5v1A1.5 1.5 0 003 11h6a1.5 1.5 0 001.5-1.5v-1" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" />
            </svg>
            Anchor to chain
          </Hover>
        )}

        <Hover
          onClick={() => {
            if (window.confirm(`Delete "${note.title}"? This cannot be undone.`)) onDelete();
          }}
          style={{ marginTop: 18, fontSize: 12, color: '#52525b', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          hoverStyle={{ color: '#ef4444' }}
        >
          <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
            <path d="M2.5 3h7M4.5 3V2a1 1 0 011-1h1a1 1 0 011 1v1M3.5 3l.5 7a1 1 0 001 1h2a1 1 0 001-1l.5-7" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Delete note
        </Hover>
      </div>
    </div>
  );
}

function InfoSection({ title, children, topPad = 16 }: { title: string; children: ReactNode; topPad?: number }) {
  return (
    <div style={{ padding: `${topPad}px 16px 14px`, borderBottom: '1px solid #1e1e24' }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#52525b', marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</div>
    </div>
  );
}

function LinkItem({ note, dir, onSelect }: { note: CoreNote; dir: 'out' | 'in'; onSelect: (id: number) => void }) {
  const [h, setH] = useState(false);
  const isOut = dir === 'out';
  return (
    <div
      onClick={() => onSelect(note.id)}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{ fontSize: 12.5, color: isOut ? '#818cf8' : '#a1a1aa', cursor: 'pointer', padding: '5px 9px', borderRadius: 5, background: h ? '#1c1c22' : '#16161a', display: 'flex', alignItems: 'center', gap: 6 }}
    >
      {isOut ? (
        <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
          <path d="M2 5h6M5.5 2.5L8 5l-2.5 2.5" stroke="#818cf8" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
          <path d="M8 5H2M4.5 2.5L2 5l2.5 2.5" stroke="#71717a" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title}</span>
    </div>
  );
}
