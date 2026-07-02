// Searchable palette of catalog nodes (#274). Click (or drag) a node to add it
// to the canvas. Grouped by category; filtered by a fuzzy substring match on
// title, type, and description.

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input, cn } from '@/ui';
import { NodeCatalog } from '../nodeCatalog';
import { NodeDescriptor } from '../nodeModel';
import { CATEGORY_ORDER, categoryMeta } from './categoryMeta';

interface NodePaletteProps {
  catalog: NodeCatalog;
  onAdd: (descriptor: NodeDescriptor) => void;
}

export function NodePalette({ catalog, onAdd }: NodePaletteProps) {
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (d: NodeDescriptor) =>
      !q ||
      d.title.toLowerCase().includes(q) ||
      d.type.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q);

    return CATEGORY_ORDER.map((category) => ({
      category,
      nodes: catalog.listByCategory(category).filter(matches),
    })).filter((g) => g.nodes.length > 0);
  }, [catalog, query]);

  const totalEmpty = grouped.length === 0;

  return (
    <div
      className="flex w-[220px] shrink-0 flex-col overflow-hidden border-r border-border"
      role="complementary"
      aria-label="Node palette"
    >
      <div className="p-2.5 pb-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search nodes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search nodes"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {totalEmpty && (
          <div className="p-2 text-xs text-muted-foreground">No nodes match “{query}”.</div>
        )}
        {grouped.map((group) => (
          <div key={group.category}>
            <div className="mx-1 mb-1.5 mt-2.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {categoryMeta(group.category).label}
            </div>
            {group.nodes.map((node) => (
              <button
                key={`${node.type}@${node.version}`}
                type="button"
                className="group mb-0.5 flex w-full cursor-grab items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:cursor-grabbing"
                title={node.description}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/blueprint-node', `${node.type}@${node.version}`);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => onAdd(node)}
              >
                <span
                  className={cn('size-1.5 shrink-0 rounded-full', categoryMeta(node.category).dotClass)}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">{node.title}</span>
                  <span className="block truncate font-mono text-[10.5px] text-muted-foreground/80">{node.type}</span>
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
