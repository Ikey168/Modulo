// Tag Explorer - turns flat, '/'-delimited tags into a browsable nested tree
// with per-tag counts. Selecting a tag (a parent includes its descendants)
// filters the notes list; opening a note switches to the notes view.
import { useMemo, useState } from 'react';
import { ChevronRight, Hash, Tags, X } from 'lucide-react';
import { EmptyState, ScrollArea, cn } from '@/ui';
import type { CoreNote } from '@modulo/core';
import { relativeTime } from './workspaceUtils';
import { buildTagTree, noteMatchesTag, type TagTreeNode } from './tagTree';

interface TagExplorerViewProps {
  notes: CoreNote[];
  onOpenNote: (id: number) => void;
}

export function TagExplorerView({ notes, onOpenNote }: TagExplorerViewProps) {
  const tree = useMemo(() => buildTagTree(notes), [notes]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(
    () => (selected ? notes.filter((n) => noteMatchesTag(n, selected)) : notes),
    [notes, selected],
  );

  const toggle = (key: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="flex flex-1 animate-fade-in overflow-hidden bg-background">
      {/* Tag tree */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-border">
        <header className="flex h-11 shrink-0 items-center gap-1.5 border-b border-border px-3">
          <Tags className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium">Tags</span>
        </header>
        {tree.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-4">
            <EmptyState icon={<Tags className="size-5" />} title="No tags yet" description="Tag a few notes to browse them here." />
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <nav className="p-1.5" aria-label="Tag tree">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className={cn(
                  'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                  selected === null ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Hash className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate">All notes</span>
                <span className="shrink-0 text-xxs tabular-nums text-muted-foreground">{notes.length}</span>
              </button>
              {tree.map((node) => (
                <TagRow
                  key={node.key}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  selected={selected}
                  onToggle={toggle}
                  onSelect={setSelected}
                />
              ))}
            </nav>
          </ScrollArea>
        )}
      </aside>

      {/* Filtered notes */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4">
          <span className="truncate text-sm font-medium text-foreground">{selected ?? 'All notes'}</span>
          <span className="shrink-0 text-xxs tabular-nums text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? 'note' : 'notes'}
          </span>
          {selected && (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-xxs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3" aria-hidden="true" />
              Clear
            </button>
          )}
        </header>
        {filtered.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState icon={<Hash className="size-5" />} title="No notes" description="No notes match this tag." />
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <ul className="divide-y divide-border">
              {filtered.map((n) => (
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
      </section>
    </div>
  );
}

interface TagRowProps {
  node: TagTreeNode;
  depth: number;
  expanded: Set<string>;
  selected: string | null;
  onToggle: (key: string) => void;
  onSelect: (key: string) => void;
}

function TagRow({ node, depth, expanded, selected, onToggle, onSelect }: TagRowProps) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.key);
  return (
    <>
      <div
        className={cn(
          'flex items-center rounded-md text-sm transition-colors',
          selected === node.key ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => onToggle(node.key)}
          aria-label={isOpen ? 'Collapse' : 'Expand'}
          className={cn('flex size-5 shrink-0 items-center justify-center rounded', hasChildren ? 'hover:bg-muted-foreground/10' : 'invisible')}
        >
          <ChevronRight className={cn('size-3.5 transition-transform', isOpen && 'rotate-90')} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onSelect(node.key)}
          className="flex flex-1 items-center gap-1.5 overflow-hidden py-1.5 pr-2 text-left"
        >
          <span className="flex-1 truncate">{node.name}</span>
          <span className="shrink-0 text-xxs tabular-nums text-muted-foreground">{node.count}</span>
        </button>
      </div>
      {hasChildren && isOpen && node.children.map((c) => (
        <TagRow
          key={c.key}
          node={c}
          depth={depth + 1}
          expanded={expanded}
          selected={selected}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}
