import {PropertyQueryResults} from '../knowledge/PropertyQueryView';
import {NotePropertyPanel} from '../knowledge/NotePropertyPanel';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  Anchor,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  Eye,
  Info,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { CoreLink, CoreNote } from '@modulo/core';
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
import { NoteTree } from './NoteTree';
import { noteExcerpt, searchNotes, type NoteSearchResult } from './noteSearch';
import { getNoteDraft, noteText } from './noteDrafts';
import { useNoteTree, type NoteTreeApi } from './noteTree';
import { anchorRef, isAnchored, relativeTime } from './workspaceUtils';
import type { WorkspaceData } from './useCoreWorkspace';
import { usePhoneImmersive } from './mobile/phoneScreen';
import { usePhoneLayout } from './mobile/usePhoneLayout';
import type {
  EditorActionContribution,
  NoteFenceContribution,
  NotePanelContribution,
} from './plugins/types';

interface NotesViewProps {
  data: WorkspaceData;
  selectedId: number | null;
  onSelect: (id: number) => void;
  editMode: boolean;
  onToggleEdit: (v: boolean) => void;
  searchQuery: string;
  onSearch: (q: string) => void;
  onNewNote: () => void;
  onClearSelection?: () => void;
  /** Detail-panel sections contributed by plugins (e.g. the Outline). */
  notePanels?: NotePanelContribution[];
  /** ```fence renderers contributed by plugins (e.g. Databases). */
  noteFences?: NoteFenceContribution[];
  /** Editor toolbar actions contributed by plugins (e.g. Insert database). */
  editorActions?: EditorActionContribution[];
}

interface NoteRelation {
  link: CoreLink;
  note: CoreNote;
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
  onClearSelection,
  notePanels = [],
  noteFences = [],
  editorActions = [],
}: NotesViewProps) {
  const {
    notes,
    links,
    updateNote,
    deleteNote,
    anchorNote,
    addTag,
    removeTag,
    createLink,
    removeLink,
  } = data;
  // <md: the list is primary; opening a note switches to the full-width editor.
  const [mobileDetailOpen, setMobileDetailOpen] = useState(selectedId !== null);
  useEffect(() => { if (selectedId !== null) setMobileDetailOpen(true); }, [selectedId]);
  const [infoOpen, setInfoOpen] = useState(false);
  // Notion-style hierarchy (parent/order kept client-side) over the note list.
  const tree = useNoteTree(notes);

  const note = useMemo(
    () => selectedId === null ? notes[0] ?? null : notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId],
  );

  const searchResults = useMemo(() => searchNotes(notes, searchQuery), [notes, searchQuery]);

  // Outgoing / incoming derived from the global link set.
  const outgoingLinks = useMemo<NoteRelation[]>(() => {
    if (!note) return [];
    return links
      .filter((l) => l.sourceNoteId === note.id)
      .map((link) => ({ link, note: notes.find((n) => n.id === link.targetNoteId) }))
      .filter((relation): relation is NoteRelation => Boolean(relation.note));
  }, [links, notes, note]);

  const backlinkLinks = useMemo<NoteRelation[]>(() => {
    if (!note) return [];
    return links
      .filter((l) => l.targetNoteId === note.id)
      .map((link) => ({ link, note: notes.find((n) => n.id === link.sourceNoteId) }))
      .filter((relation): relation is NoteRelation => Boolean(relation.note));
  }, [links, notes, note]);

  const outgoing = useMemo(() => outgoingLinks.map(({ note: linkedNote }) => linkedNote), [outgoingLinks]);

  const openNote = (id: number) => {
    onSelect(id);
    setMobileDetailOpen(true);
  };

  // Obsidian-style: clicking a [[Missing Note]] link creates it and opens it.
  const createFromLink = async (title: string) => {
    const created = await data.createNote(title);
    if (created) {
      openNote(created.id);
      onToggleEdit(true);
    }
  };

  // Notion-style "+" on a row: create a subnote nested under that note.
  const addChild = async (parentId: number) => {
    const created = await data.createNote();
    if (created) {
      tree.setParent(created.id, parentId);
      tree.expand(parentId);
      openNote(created.id);
      onToggleEdit(true);
    }
  };

  const showDetailOnMobile = mobileDetailOpen && note != null;
  // An open note is the whole phone screen: the shell folds away the app bar
  // and the hub's tab strip, and the editor's own header — which carries the
  // back arrow — becomes the only bar. See mobile/phoneScreen.tsx.
  const phoneLayout = usePhoneLayout();
  usePhoneImmersive('notes', phoneLayout && showDetailOnMobile);

  const infoPanelProps = note
    ? {
        note,
        outgoing,
        allNotes: notes,
        notePanels,
        onSelect: openNote,
        onAnchor: () => anchorNote(note.id),
        onAddTag: (name: string) => addTag(note.id, name),
        onRemoveTag: (tagId: string) => removeTag(note.id, tagId),
        onCreateLink: (targetId: number) => createLink(note.id, targetId),
        onRemoveLink: (linkId: string) => { void removeLink(linkId); },
        onLinksChanged: data.refresh,
        outgoingLinks,
        backlinkLinks,
        onDelete: () => {
          setInfoOpen(false);
          setMobileDetailOpen(false);
          onClearSelection?.();
          void deleteNote(note.id);
        },
      }
    : null;

  return (
    <div className="flex h-full w-full animate-fade-in overflow-hidden">
      <NoteListColumn
        className={cn('w-full md:w-64', showDetailOnMobile ? 'hidden md:flex' : 'flex')}
        notes={notes}
        searchResults={searchResults}
        tree={tree}
        selectedId={note?.id ?? selectedId}
        loading={data.loading}
        searchQuery={searchQuery}
        onSearch={onSearch}
        onNewNote={onNewNote}
        onSelect={openNote}
        onAddChild={addChild}
      />

      <div className={cn('min-w-0 flex-1 flex-col overflow-hidden', showDetailOnMobile ? 'flex' : 'hidden md:flex')}>
        {note ? (
          <Editor
            key={note.id}
            note={note}
            editMode={editMode}
            onToggleEdit={onToggleEdit}
            onPropertySaved={()=>void data.refresh()}
            onSave={(title, content) => updateNote(note.id, { title, content, markdownContent: content })}
            onSelectNote={openNote}
            allNotes={notes}
            onBack={() => setMobileDetailOpen(false)}
            onOpenInfo={() => setInfoOpen(true)}
            onCreateNote={createFromLink}
            noteFences={noteFences}
            editorActions={editorActions}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            {data.loading ? (
              <Spinner className="size-5 text-muted-foreground" />
            ) : (
              <EmptyState
                icon={<NoteGlyph />}
                title={notes.length ? "Note unavailable" : "No notes yet"}
                description={notes.length ? "This note may be in Trash. Choose a note from the list or open Recovery." : "Create your first note to start building your knowledge base."}
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
          <SheetContent side="right" className="w-full gap-0 bg-surface p-0 sm:w-80 sm:max-w-80">
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
  searchResults: NoteSearchResult[];
  tree: NoteTreeApi;
  selectedId: number | null;
  loading: boolean;
  searchQuery: string;
  onSearch: (q: string) => void;
  onNewNote: () => void;
  onSelect: (id: number) => void;
  onAddChild: (parentId: number) => void;
  className?: string;
}

function NoteListColumn({ notes, searchResults, tree, selectedId, loading, searchQuery, onSearch, onNewNote, onSelect, onAddChild, className }: NoteListColumnProps) {
  // While filtering, show a flat match list; otherwise the draggable tree.
  const searching = searchQuery.trim().length > 0;
  return (
    <div className={cn('shrink-0 flex-col overflow-hidden border-r border-border', className)}>
      {/* The phone shell already titles this screen "Notes" and offers the
          floating New note button, so the header is desktop-only chrome. */}
      <div className="flex shrink-0 items-center justify-between px-3 pb-2 pt-3 phone:hidden">
        <SectionLabel>Notes</SectionLabel>
        <Button variant="ghost" size="icon-sm" className="h-6 w-6" onClick={onNewNote} aria-label="New note" title="New note">
          <Plus aria-hidden="true" />
        </Button>
      </div>

      <div className="shrink-0 px-2.5 pb-2 phone:px-3 phone:pt-3">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground coarse:left-3 coarse:size-4"
          />
          <Input
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search notes, tags, and content…"
            aria-label="Search notes"
            className={cn('h-8 pl-8 text-xs coarse:h-11 coarse:pl-9 coarse:text-[15px]', searchQuery && 'pr-8')}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearch('')}
              aria-label="Clear note search"
              className="absolute right-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground coarse:size-9"
            >
              <X className="size-3 coarse:size-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="mt-1 px-0.5 text-xxs text-muted-foreground" aria-live="polite">
          {searching
            ? `${searchResults.length} ${searchResults.length === 1 ? 'match' : 'matches'}`
            : `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading && notes.length === 0 ? (
          <div className="flex flex-col gap-1.5 px-1 pt-1" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (searching ? searchResults.length === 0 : notes.length === 0) ? (
          <p className="px-2 pt-2 text-xs text-muted-foreground">
            {searching ? 'No notes match your search.' : 'No notes yet.'}
          </p>
        ) : searching ? (
          searchResults.map(({ note, excerpt }) => (
            <NoteRow key={note.id} note={note} excerpt={excerpt} selected={note.id === selectedId} onSelect={onSelect} />
          ))
        ) : (
          <NoteTree tree={tree} selectedId={selectedId} onSelect={onSelect} onAddChild={onAddChild} />
        )}
      </div>
    </div>
  );
}

function NoteRow({ note, excerpt = noteExcerpt(note), selected, onSelect }: { note: CoreNote; excerpt?: string; selected: boolean; onSelect: (id: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(note.id)}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-md px-2.5 py-1 text-left transition-colors',
        'coarse:min-h-touch coarse:px-3 coarse:text-[15px] coarse:active:bg-surface-2',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        selected ? 'bg-surface-3' : 'hover:bg-surface-2',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn('min-w-0 flex-1 truncate text-[13px]', selected ? 'font-medium text-foreground' : 'text-subtle-foreground')}>
            {note.title || 'Untitled Note'}
          </span>
          {note.updatedAt && <span className="shrink-0 text-xxs tabular-nums text-muted-foreground">{relativeTime(note.updatedAt)}</span>}
        </span>
        {excerpt && <span className="mt-0.5 block line-clamp-1 text-xxs leading-relaxed text-muted-foreground">{excerpt}</span>}
      </span>
      {isAnchored(note) && (
        <span className="size-[5px] shrink-0 rounded-full bg-success" role="img" aria-label="Anchored on-chain" />
      )}
    </button>
  );
}

// ── Editor ───────────────────────────────────────────────────────────────────

interface EditorProps {
  note: CoreNote;
  editMode: boolean;
  onToggleEdit: (v: boolean) => void;
  onSave: (title: string, content: string) => Promise<boolean | void>;
  onPropertySaved: () => void;
  onSelectNote: (id: number) => void;
  allNotes: CoreNote[];
  onBack: () => void;
  onOpenInfo: () => void;
  onCreateNote: (title: string) => void;
  noteFences: NoteFenceContribution[];
  editorActions: EditorActionContribution[];
}

function Editor({ note, editMode, onToggleEdit, onSave, onPropertySaved, onSelectNote, allNotes, onBack, onOpenInfo, onCreateNote, noteFences, editorActions }: EditorProps) {
  const draft = getNoteDraft(note, (text) => onSave(text.title, text.content));
  const { title, content, status, local } = useSyncExternalStore(draft.subscribe, draft.getSnapshot);
  const setTitle = (value: string) => draft.change({ title: value });
  const setContent = (value: string) => draft.change({ content: value });
  const flush = () => { void draft.flush(); };
  useEffect(() => { draft.accept(noteText(note)); }, [draft, note]);
  useEffect(() => () => { void draft.flush(); }, [draft]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Generic insert-at-cursor handed to plugin editor actions (e.g. the Database
  // plugin's "Insert database"), so the editor stays agnostic of any one plugin.
  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    const start = ta?.selectionStart ?? content.length;
    const end = ta?.selectionEnd ?? content.length;
    const next = content.slice(0, start) + text + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      const pos = start + text.length;
      ta?.focus();
      ta?.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {/* Below `md` this header *is* the app bar — the shell has folded its own
          away — so it carries the status bar inset and full-size controls
          rather than the 28px icons a dense desktop toolbar can use. */}
      <div className="-mt-safe-top flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-3 pt-safe-top phone:h-auto phone:min-h-14 phone:gap-0.5 phone:px-1 md:mt-0 md:bg-transparent md:px-5 md:pt-0">
        <div className="flex min-w-0 flex-1 items-center gap-2 phone:gap-0.5">
          <Button variant="ghost" size="icon-sm" className="md:hidden phone:size-11" onClick={onBack} aria-label="Back to note list">
            <ChevronLeft aria-hidden="true" className="phone:size-5" />
          </Button>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={flush}
            placeholder="Untitled Note"
            aria-label="Note title"
            className="min-w-0 flex-1 truncate bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground phone:text-base"
          />
          {isAnchored(note) && (
            <Badge variant="success" className="shrink-0 tracking-wider">
              ON-CHAIN
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {/* "Saved" on every keystroke is reassurance a desktop can afford;
              a phone header cannot, so only states that need action show. */}
          <span
            role="status"
            className={cn('text-xs text-muted-foreground', status === 'Saved' && 'phone:hidden')}
          >
            {status}
          </span>
          {(status === 'Save failed' || status === 'Unsaved') && <Button size="sm" variant="ghost" onClick={flush}>Retry save</Button>}
          <Tabs
            className="phone:hidden"
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
          {/* A 120px segmented control leaves no room for the note's title on a
              360dp screen; the same choice is one labelled icon here. */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden phone:inline-flex phone:size-11 phone:[&_svg]:size-5"
            aria-label={editMode ? 'Preview note' : 'Edit note'}
            onClick={() => {
              if (editMode) flush();
              onToggleEdit(!editMode);
            }}
          >
            {editMode ? <Eye aria-hidden="true" /> : <Pencil aria-hidden="true" />}
          </Button>
          <Button variant="ghost" size="icon-sm" className="xl:hidden phone:size-11 phone:[&_svg]:size-5" onClick={onOpenInfo} aria-label="Note details">
            <Info aria-hidden="true" />
          </Button>
        </div>
      </div>

      {!local && <p role="alert" className="px-3 py-2 text-xs text-destructive">Draft recovery is unavailable. Keep this page open until the note is saved.</p>}
      <NotePropertyPanel key={note.id} noteId={note.id} content={content} notes={allNotes} contentBusy={status !== 'Saved'} onSaved={next => { draft.accept({ title, content: next }); onPropertySaved(); }}/>
      <div className="relative flex-1 overflow-hidden">
        {editMode ? (
          <div className="flex h-full flex-col">
            {editorActions.length > 0 && (
              <div className="scroll-strip flex shrink-0 items-center gap-1 border-b border-border px-3 py-1.5 md:px-8">
                {editorActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Button
                      key={action.id}
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => action.run({ insertAtCursor })}
                      title={action.label}
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                      {action.label}
                    </Button>
                  );
                })}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={flush}
              aria-label="Note content (Markdown)"
              className="w-full flex-1 resize-none bg-transparent px-5 py-5 font-mono text-sm leading-[1.8] text-foreground/90 outline-none [tab-size:2] placeholder:text-muted-foreground phone:px-4 phone:py-4 phone:text-[15px] phone:leading-[1.7] md:px-10"
            />
          </div>
        ) : (
          <div className="h-full overflow-y-auto overscroll-contain px-5 py-6 phone:px-4 phone:py-5 md:px-10 md:py-8">
            <Markdown content={content} notes={allNotes} onSelectNote={onSelectNote} onCreateNote={onCreateNote} fences={[...noteFences,{language:"property-query",component:({source}:{source:string})=>/^[0-9a-f-]{36}$/.test(source.trim())?<PropertyQueryResults id={source.trim()}/>:<p>Invalid saved query ID.</p>}]} />
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
  outgoingLinks: NoteRelation[];
  backlinkLinks: NoteRelation[];
  allNotes: CoreNote[];
  notePanels?: NotePanelContribution[];
  onSelect: (id: number) => void;
  onAnchor: () => void;
  onAddTag: (name: string) => void;
  onRemoveTag: (tagId: string) => void;
  onCreateLink: (targetId: number) => void;
  onRemoveLink: (linkId: string) => void;
  onLinksChanged: () => Promise<void>;
  onDelete: () => void;
  className?: string;
}

function InfoPanel({
  note,
  outgoing,
  outgoingLinks,
  backlinkLinks,
  allNotes,
  notePanels = [],
  onSelect,
  onAnchor,
  onAddTag,
  onRemoveTag,
  onCreateLink,
  onRemoveLink,
  onLinksChanged,
  onDelete,
  className,
}: InfoPanelProps) {
  const [tagDraft, setTagDraft] = useState('');
  // Remount the link Select after each pick so it snaps back to the placeholder.
  const [selectKey, setSelectKey] = useState(0);
  const linkableNotes = allNotes.filter((n) => n.id !== note.id && !outgoingLinks.some(({ note: linkedNote }) => linkedNote.id === n.id));

  return (
    <div className={cn('w-60 shrink-0 flex-col overflow-y-auto border-l border-border', className)}>
      {notePanels.map((panel) => {
        const Panel = panel.component;
        const content = <Panel
          note={note}
          allNotes={allNotes}
          outgoing={outgoing}
          onCreateLink={onCreateLink}
          onSelectNote={onSelect}
          onLinksChanged={onLinksChanged}
        />;
        return panel.standalone ? <div key={panel.id}>{content}</div> : (
          <InfoSection key={panel.id} title={panel.title}>{content}</InfoSection>
        );
      })}

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
                className="rounded-full p-0.5 text-primary/60 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <X className="size-2.5" aria-hidden="true" />
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
        {outgoingLinks.length === 0 ? (
          <span className="px-0.5 py-1 text-xs text-muted-foreground">—</span>
        ) : (
          outgoingLinks.map(({ link, note: linkedNote }) => (
            <LinkItem key={link.id} linkId={link.id} note={linkedNote} dir="out" onSelect={onSelect} onRemove={onRemoveLink} />
          ))
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
                  {n.title || 'Untitled Note'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </InfoSection>

      <InfoSection title="Backlinks">
        {backlinkLinks.length === 0 ? (
          <span className="px-0.5 py-1 text-xs text-muted-foreground">—</span>
        ) : (
          backlinkLinks.map(({ link, note: linkedNote }) => (
            <LinkItem key={link.id} linkId={link.id} note={linkedNote} dir="in" onSelect={onSelect} onRemove={onRemoveLink} />
          ))
        )}
      </InfoSection>

      <div className="px-4 pb-5 pt-4">
        <SectionLabel className="mb-2.5">On-Chain</SectionLabel>
        {isAnchored(note) ? (
          <div className="rounded-lg border border-success/20 bg-success/5 px-3 py-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-success">
              <Check className="size-3" aria-hidden="true" />
              Anchored
            </div>
            <div className="break-all font-mono text-xxs leading-relaxed text-muted-foreground">
              {anchorRef(note) ?? 'recorded'}
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground" onClick={onAnchor}>
            <Anchor aria-hidden="true" />
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
              <Trash2 aria-hidden="true" />
              Move to Trash
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Move “{note.title}” to Trash?</AlertDialogTitle>
              <AlertDialogDescription>
                The note moves to Trash on this device. You can restore it with its links from Recovery.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className={buttonVariants({ variant: 'destructive' })} onClick={onDelete}>
                Move to Trash
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

function LinkItem({ linkId, note, dir, onSelect, onRemove }: { linkId: string; note: CoreNote; dir: 'out' | 'in'; onSelect: (id: number) => void; onRemove: (linkId: string) => void }) {
  const isOut = dir === 'out';
  return (
    <div className="group/link flex w-full items-center gap-1 rounded-md transition-colors hover:bg-surface-2">
      <button
        type="button"
        onClick={() => onSelect(note.id)}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          isOut ? 'text-primary-hover' : 'text-subtle-foreground',
        )}
      >
        {isOut ? (
          <ArrowRight className="size-2.5 shrink-0" aria-hidden="true" />
        ) : (
          <ArrowLeft className="size-2.5 shrink-0" aria-hidden="true" />
        )}
        <span className="truncate">{note.title || 'Untitled Note'}</span>
      </button>
      <button
        type="button"
        onClick={() => onRemove(linkId)}
        aria-label={`Remove link ${isOut ? 'to' : 'from'} ${note.title || 'Untitled Note'}`}
        title="Remove link"
        className="mr-1 flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-colors hover:bg-surface-3 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring coarse:opacity-100"
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </div>
  );
}
