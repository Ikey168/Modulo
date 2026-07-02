import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CoreNote } from '@modulo/core';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  buttonVariants,
  cn,
  EmptyState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Spinner,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/ui';
import { SectionLabel } from './atoms';
import { Markdown } from './Markdown';
import { anchorRef, isAnchored, relativeTime } from './workspaceUtils';
import type { WorkspaceData } from './useCoreWorkspace';

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
  // <md: the list is primary; opening a note switches to the full-width editor.
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

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

  const openNote = (id: number) => {
    onSelect(id);
    setMobileDetailOpen(true);
  };

  const showDetailOnMobile = mobileDetailOpen && note != null;

  const infoPanelProps = note
    ? {
        note,
        outgoing,
        backlinks,
        allNotes: notes,
        onSelect: openNote,
        onAnchor: () => anchorNote(note.id),
        onAddTag: (name: string) => addTag(note.id, name),
        onRemoveTag: (tagId: string) => removeTag(note.id, tagId),
        onCreateLink: (targetId: number) => createLink(note.id, targetId),
        onDelete: () => {
          setInfoOpen(false);
          setMobileDetailOpen(false);
          void deleteNote(note.id);
        },
      }
    : null;

  return (
    <div className="flex h-full w-full animate-fade-in overflow-hidden">
      <NoteListColumn
        className={cn('w-full md:w-64', showDetailOnMobile ? 'hidden md:flex' : 'flex')}
        notes={filtered}
        selectedId={note?.id ?? selectedId}
        loading={data.loading}
        searchQuery={searchQuery}
        onSearch={onSearch}
        onNewNote={onNewNote}
        onSelect={openNote}
      />

      <div className={cn('min-w-0 flex-1 flex-col overflow-hidden', showDetailOnMobile ? 'flex' : 'hidden md:flex')}>
        {note ? (
          <Editor
            key={note.id}
            note={note}
            editMode={editMode}
            onToggleEdit={onToggleEdit}
            onSave={(title, content) => updateNote(note.id, { title, content, markdownContent: content })}
            onSelectNote={openNote}
            allNotes={notes}
            onBack={() => setMobileDetailOpen(false)}
            onOpenInfo={() => setInfoOpen(true)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            {data.loading ? (
              <Spinner className="size-5 text-muted-foreground" />
            ) : (
              <EmptyState
                icon={<NoteGlyph />}
                title="No notes yet"
                description="Create your first note to start building your knowledge base."
                action={<Button size="sm" onClick={onNewNote}>New note</Button>}
              />
            )}
          </div>
        )}
      </div>

      {/* ≥xl: info panel inline as the third column. */}
      {infoPanelProps && <InfoPanel {...infoPanelProps} className="hidden xl:flex" />}

      {/* <xl: same panel in a right-hand sheet, opened from the editor header. */}
      {infoPanelProps && (
        <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
          <SheetContent side="right" className="w-80 gap-0 bg-surface p-0 sm:max-w-80">
            <SheetHeader className="border-b border-border px-4 py-3.5 text-left">
              <SheetTitle className="text-sm">Note details</SheetTitle>
              <SheetDescription className="sr-only">Tags, links and on-chain status for the selected note</SheetDescription>
            </SheetHeader>
            <InfoPanel {...infoPanelProps} className="flex w-full border-l-0" />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

function NoteGlyph() {
  return (
    <svg viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M3 1.5h9a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1v-10a1 1 0 011-1z" stroke="currentColor" strokeWidth={1.2} fill="none" />
      <path d="M4 5h7M4 7.5h7M4 10h4" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" />
    </svg>
  );
}

// ── Note list column ───────────────────────────────────────────────────────

interface NoteListColumnProps {
  notes: CoreNote[];
  selectedId: number | null;
  loading: boolean;
  searchQuery: string;
  onSearch: (q: string) => void;
  onNewNote: () => void;
  onSelect: (id: number) => void;
  className?: string;
}

function NoteListColumn({ notes, selectedId, loading, searchQuery, onSearch, onNewNote, onSelect, className }: NoteListColumnProps) {
  return (
    <div className={cn('shrink-0 flex-col overflow-hidden border-r border-border bg-surface', className)}>
      <div className="flex shrink-0 items-center justify-between px-3 pb-2.5 pt-3.5">
        <SectionLabel>Notes</SectionLabel>
        <Button size="icon-sm" className="h-6 w-6 rounded-[5px] [&_svg]:size-2.5" onClick={onNewNote} aria-label="New note" title="New note">
          <svg viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
          </svg>
        </Button>
      </div>

      <div className="shrink-0 px-2.5 pb-2">
        <div className="relative">
          <svg
            width={12}
            height={12}
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            <circle cx={5} cy={5} r={3.5} stroke="currentColor" strokeWidth={1.2} />
            <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" />
          </svg>
          <Input
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Filter notes…"
            aria-label="Filter notes"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading && notes.length === 0 ? (
          <div className="flex flex-col gap-1.5 px-1 pt-1" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <p className="px-2 pt-2 text-xs text-muted-foreground">
            {searchQuery ? 'No notes match your filter.' : 'No notes yet.'}
          </p>
        ) : (
          notes.map((n) => <NoteRow key={n.id} note={n} selected={n.id === selectedId} onSelect={onSelect} />)
        )}
      </div>
    </div>
  );
}

function NoteRow({ note, selected, onSelect }: { note: CoreNote; selected: boolean; onSelect: (id: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(note.id)}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'mb-0.5 block w-full rounded-md border-l-2 px-2.5 py-1.5 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-primary bg-surface-3' : 'border-transparent hover:bg-surface-2',
      )}
    >
      <span className="flex items-center gap-1.5">
        <span className={cn('min-w-0 flex-1 truncate text-[13px]', selected ? 'font-medium text-foreground' : 'text-subtle-foreground')}>
          {note.title}
        </span>
        {isAnchored(note) && (
          <span className="size-[5px] shrink-0 rounded-full bg-success" role="img" aria-label="Anchored on-chain" />
        )}
      </span>
      <span className="mt-0.5 block text-xxs text-muted-foreground">{relativeTime(note.updatedAt)}</span>
    </button>
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
  onBack: () => void;
  onOpenInfo: () => void;
}

function Editor({ note, editMode, onToggleEdit, onSave, onSelectNote, allNotes, onBack, onOpenInfo }: EditorProps) {
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
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-3 md:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onBack} aria-label="Back to note list">
            <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M7.5 2L3.5 6l4 4" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
          <h2 className="truncate text-sm font-semibold text-foreground">{title || 'Untitled Note'}</h2>
          {isAnchored(note) && (
            <Badge variant="success" className="shrink-0 tracking-wider">
              ON-CHAIN
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Tabs
            value={editMode ? 'edit' : 'preview'}
            onValueChange={(v) => {
              if (v === 'preview') flush();
              onToggleEdit(v === 'edit');
            }}
          >
            <TabsList className="h-8 p-0.5">
              <TabsTrigger value="edit" className="px-3 py-1 text-xs">
                Edit
              </TabsTrigger>
              <TabsTrigger value="preview" className="px-3 py-1 text-xs">
                Preview
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="icon-sm" className="xl:hidden" onClick={onOpenInfo} aria-label="Note details">
            <svg viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <circle cx={7.5} cy={7.5} r={6} stroke="currentColor" strokeWidth={1.2} />
              <path d="M7.5 7v3.5" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
              <circle cx={7.5} cy={4.7} r={0.8} fill="currentColor" />
            </svg>
          </Button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {editMode ? (
          <div className="flex h-full flex-col">
            <input
              value={title}
              onChange={(e) => {
                dirtyRef.current = true;
                setTitle(e.target.value);
              }}
              onBlur={flush}
              placeholder="Note title"
              aria-label="Note title"
              className="border-b border-border bg-transparent px-5 pb-3.5 pt-4 text-lg font-semibold text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary md:px-10"
            />
            <textarea
              value={content}
              onChange={(e) => {
                dirtyRef.current = true;
                setContent(e.target.value);
              }}
              onBlur={flush}
              aria-label="Note content (Markdown)"
              className="w-full flex-1 resize-none bg-transparent px-5 py-5 font-mono text-sm leading-[1.8] text-foreground/90 outline-none [tab-size:2] placeholder:text-muted-foreground md:px-10"
            />
          </div>
        ) : (
          <div className="h-full overflow-y-auto px-5 py-6 md:px-10 md:py-8">
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
  className?: string;
}

function InfoPanel({
  note,
  outgoing,
  backlinks,
  allNotes,
  onSelect,
  onAnchor,
  onAddTag,
  onRemoveTag,
  onCreateLink,
  onDelete,
  className,
}: InfoPanelProps) {
  const [tagDraft, setTagDraft] = useState('');
  // Remount the link Select after each pick so it snaps back to the placeholder.
  const [selectKey, setSelectKey] = useState(0);
  const linkableNotes = allNotes.filter((n) => n.id !== note.id && !outgoing.some((o) => o.id === n.id));

  return (
    <div className={cn('w-60 shrink-0 flex-col overflow-y-auto border-l border-border bg-surface', className)}>
      <InfoSection title="Tags">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {(note.tags ?? []).map((tag) => (
            <Badge key={tag.id} className="gap-1 pr-1">
              {tag.name}
              <button
                type="button"
                onClick={() => onRemoveTag(tag.id)}
                aria-label={`Remove tag ${tag.name}`}
                title="Remove tag"
                className="rounded-full px-0.5 text-primary/60 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                ×
              </button>
            </Badge>
          ))}
          {(note.tags ?? []).length === 0 && <span className="text-xs text-muted-foreground">—</span>}
        </div>
        <Input
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && tagDraft.trim()) {
              onAddTag(tagDraft.trim());
              setTagDraft('');
            }
          }}
          placeholder="Add tag…"
          aria-label="Add tag"
          className="h-7 text-xs"
        />
      </InfoSection>

      <InfoSection title="Links to">
        {outgoing.length === 0 ? (
          <span className="px-0.5 py-1 text-xs text-muted-foreground">—</span>
        ) : (
          outgoing.map((n) => <LinkItem key={n.id} note={n} dir="out" onSelect={onSelect} />)
        )}
        {linkableNotes.length > 0 && (
          <Select
            key={selectKey}
            onValueChange={(v) => {
              onCreateLink(Number(v));
              setSelectKey((k) => k + 1);
            }}
          >
            <SelectTrigger className="mt-1.5 h-7 text-xs" aria-label="Link to note">
              <SelectValue placeholder="+ Link to note…" />
            </SelectTrigger>
            <SelectContent>
              {linkableNotes.map((n) => (
                <SelectItem key={n.id} value={String(n.id)}>
                  {n.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </InfoSection>

      <InfoSection title="Backlinks">
        {backlinks.length === 0 ? (
          <span className="px-0.5 py-1 text-xs text-muted-foreground">—</span>
        ) : (
          backlinks.map((n) => <LinkItem key={n.id} note={n} dir="in" onSelect={onSelect} />)
        )}
      </InfoSection>

      <div className="px-4 pb-5 pt-4">
        <SectionLabel className="mb-2.5">On-Chain</SectionLabel>
        {isAnchored(note) ? (
          <div className="rounded-lg border border-success/20 bg-success/5 px-3 py-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-success">
              <svg width={11} height={11} viewBox="0 0 11 11" fill="none" aria-hidden="true">
                <path d="M2 5.5l2.5 2.5L9 3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Anchored
            </div>
            <div className="break-all font-mono text-xxs leading-relaxed text-muted-foreground">
              {anchorRef(note) ?? 'recorded'}
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground" onClick={onAnchor}>
            <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M6 1.5v5" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" />
              <path d="M3.5 4L6 1.5 8.5 4" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
              <path d="M1.5 8.5v1A1.5 1.5 0 003 11h6a1.5 1.5 0 001.5-1.5v-1" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" />
            </svg>
            Anchor to chain
          </Button>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="mt-4 w-full justify-start gap-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path
                  d="M2.5 3h7M4.5 3V2a1 1 0 011-1h1a1 1 0 011 1v1M3.5 3l.5 7a1 1 0 001 1h2a1 1 0 001-1l.5-7"
                  stroke="currentColor"
                  strokeWidth={1.1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Delete note
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{note.title}”?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the note and its links. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className={buttonVariants({ variant: 'destructive' })} onClick={onDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-border px-4 pb-3.5 pt-4">
      <SectionLabel className="mb-2.5">{title}</SectionLabel>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function LinkItem({ note, dir, onSelect }: { note: CoreNote; dir: 'out' | 'in'; onSelect: (id: number) => void }) {
  const isOut = dir === 'out';
  return (
    <button
      type="button"
      onClick={() => onSelect(note.id)}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1.5 text-left text-xs transition-colors',
        'hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isOut ? 'text-primary-hover' : 'text-subtle-foreground',
      )}
    >
      <svg width={10} height={10} viewBox="0 0 10 10" fill="none" aria-hidden="true" className="shrink-0">
        {isOut ? (
          <path d="M2 5h6M5.5 2.5L8 5l-2.5 2.5" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M8 5H2M4.5 2.5L2 5l2.5 2.5" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
      <span className="truncate">{note.title}</span>
    </button>
  );
}
