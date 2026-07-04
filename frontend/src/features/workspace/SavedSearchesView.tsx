// Saved Searches - named smart folders. Each saved search is a query (text plus
// required tags) evaluated live over the current notes. Searches persist in
// localStorage; opening a result switches to the notes view.
import { useEffect, useMemo, useState } from 'react';
import { FolderSearch, Plus, Search, Trash2 } from 'lucide-react';
import { Button, EmptyState, Input, ScrollArea, cn } from '@/ui';
import type { CoreNote } from '@modulo/core';
import { relativeTime } from './workspaceUtils';
import {
  addSearch,
  loadSavedSearches,
  matchNotes,
  removeSearch,
  saveSavedSearches,
  updateSearch,
  type SavedSearch,
} from './savedSearchesStore';

interface SavedSearchesViewProps {
  notes: CoreNote[];
  onOpenNote: (id: number) => void;
}

export function SavedSearchesView({ notes, onOpenNote }: SavedSearchesViewProps) {
  const [list, setList] = useState<SavedSearch[]>(() => loadSavedSearches());
  const [selectedId, setSelectedId] = useState<string | null>(() => loadSavedSearches()[0]?.id ?? null);

  // Persist, debounced so typing a query name/text writes once it settles.
  useEffect(() => {
    const t = setTimeout(() => saveSavedSearches(list), 150);
    return () => clearTimeout(t);
  }, [list]);

  const selected = list.find((s) => s.id === selectedId) ?? null;
  const results = useMemo(() => (selected ? matchNotes(notes, selected) : []), [notes, selected]);

  const tagNames = useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) for (const t of n.tags ?? []) set.add(t.name);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [notes]);

  const create = () => {
    const next = addSearch(list, `Search ${list.length + 1}`);
    setList(next);
    setSelectedId(next[next.length - 1].id);
  };
  const patch = (id: string, p: Partial<Omit<SavedSearch, 'id'>>) => setList((l) => updateSearch(l, id, p));
  const remove = (id: string) => {
    setList((l) => {
      const next = removeSearch(l, id);
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
      return next;
    });
  };
  const toggleTag = (name: string) => {
    if (!selected) return;
    const has = selected.tags.includes(name);
    patch(selected.id, { tags: has ? selected.tags.filter((t) => t !== name) : [...selected.tags, name] });
  };

  return (
    <div className="flex flex-1 animate-fade-in overflow-hidden bg-background">
      {/* Saved search list */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-border">
        <header className="flex h-11 shrink-0 items-center gap-1.5 border-b border-border px-3">
          <FolderSearch className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium">Saved Searches</span>
          <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={create} aria-label="New saved search">
            <Plus className="size-4" />
          </Button>
        </header>
        {list.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-4">
            <EmptyState
              icon={<FolderSearch className="size-5" />}
              title="No saved searches"
              description="Save a query as a smart folder that always reflects your notes."
              action={
                <Button size="sm" onClick={create}>
                  <Plus className="size-4" />
                  New search
                </Button>
              }
            />
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <nav className="p-1.5">
              {list.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={cn(
                    'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                    s.id === selectedId ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Search className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="flex-1 truncate">{s.name || 'Untitled search'}</span>
                  <span className="shrink-0 text-xxs tabular-nums text-muted-foreground">{matchNotes(notes, s).length}</span>
                </button>
              ))}
            </nav>
          </ScrollArea>
        )}
      </aside>

      {/* Editor + results */}
      <section className="flex min-w-0 flex-1 flex-col">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState
              icon={<Search className="size-5" />}
              title="No search selected"
              description="Select a saved search, or create one to get started."
            />
          </div>
        ) : (
          <>
            <header className="shrink-0 space-y-2 border-b border-border p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={selected.name}
                  onChange={(e) => patch(selected.id, { name: e.target.value })}
                  placeholder="Search name"
                  className="h-8 flex-1 font-medium"
                  aria-label="Search name"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(selected.id)}
                  aria-label="Delete search"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={selected.text}
                  onChange={(e) => patch(selected.id, { text: e.target.value })}
                  placeholder="Text in title or tags..."
                  className="h-8 pl-8"
                  aria-label="Query text"
                />
              </div>
              {tagNames.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tagNames.map((t) => {
                    const on = selected.tags.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTag(t)}
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-xxs transition-colors',
                          on
                            ? 'border-primary bg-primary/15 text-foreground'
                            : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              )}
            </header>

            {results.length === 0 ? (
              <div className="flex flex-1 items-center justify-center p-8">
                <EmptyState icon={<Search className="size-5" />} title="No matches" description="No notes match this search yet." />
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <ul className="divide-y divide-border">
                  {results.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => onOpenNote(n.id)}
                        className="block w-full px-4 py-2.5 text-left transition-colors hover:bg-surface"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{n.title || 'Untitled'}</span>
                          <span className="shrink-0 text-xxs tabular-nums text-muted-foreground">{relativeTime(n.updatedAt)}</span>
                        </div>
                        {(n.tags ?? []).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(n.tags ?? []).slice(0, 6).map((t) => (
                              <span key={t.id} className="rounded bg-muted px-1.5 py-0.5 text-xxs text-muted-foreground">
                                {t.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </>
        )}
      </section>
    </div>
  );
}
