// Searchable palette of catalog nodes (#274). Click (or drag) a node to add it
// to the canvas. Grouped by category; filtered by a fuzzy substring match on
// title, type, and description.

import { useMemo, useState } from 'react';
import { NodeCatalog } from '../nodeCatalog';
import { NodeCategory, NodeDescriptor } from '../nodeModel';

const CATEGORY_ORDER: NodeCategory[] = ['trigger', 'action', 'logic'];
const CATEGORY_LABELS: Record<NodeCategory, string> = {
  trigger: 'Triggers',
  action: 'Actions',
  logic: 'Logic',
};

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
    <div className="bp-palette" role="complementary" aria-label="Node palette">
      <div className="bp-palette__search">
        <input
          type="text"
          placeholder="Search nodes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search nodes"
        />
      </div>
      <div className="bp-palette__list">
        {totalEmpty && <div className="bp-palette__empty">No nodes match “{query}”.</div>}
        {grouped.map((group) => (
          <div key={group.category} className="bp-palette__group">
            <div className="bp-palette__group-title">{CATEGORY_LABELS[group.category]}</div>
            {group.nodes.map((node) => (
              <button
                key={`${node.type}@${node.version}`}
                type="button"
                className={`bp-palette__item bp-palette__item--${node.category}`}
                title={node.description}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/blueprint-node', `${node.type}@${node.version}`);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => onAdd(node)}
              >
                <span className="bp-palette__item-title">{node.title}</span>
                <span className="bp-palette__item-type">{node.type}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
