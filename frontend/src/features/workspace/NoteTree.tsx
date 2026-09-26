// Notion-style collapsible note tree with HTML5 drag-and-drop reordering and
// nesting. The hierarchy itself lives in `noteTree.ts` (a client-side map over
// the flat note list); this component only renders it and turns pointer drags
// into `move()` calls. HTML5 drag-and-drop does not exist on touch, so every
// row also offers the same moves from a menu (always visible on touch) and as
// Alt+Arrow keyboard shortcuts.

import { createContext, useContext, useState, type CSSProperties, type DragEvent } from 'react';
import { ChevronRight, MoreVertical, Plus } from 'lucide-react';
import { cn, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/ui';
import { isAnchored } from './workspaceUtils';
import { treeMoveOptions, type DropPos, type TreeMoveOption, type NoteTreeApi, type TreeNode } from './noteTree';

interface NoteTreeProps {
  tree: NoteTreeApi;
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Create a new subnote under the given parent and open it. */
  onAddChild: (parentId: number) => void;
}

interface DragState {
  dragId: number | null;
  hint: { id: number; pos: DropPos } | null;
}

interface TreeContext extends NoteTreeProps {
  drag: DragState;
  setDrag: (s: DragState) => void;
}

type TreeMoveOptionId = TreeMoveOption['id'];

const Ctx = createContext<TreeContext | null>(null);

const useTreeCtx = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('NoteTreeRow used outside NoteTree');
  return ctx;
};

export function NoteTree({ tree, selectedId, onSelect, onAddChild }: NoteTreeProps) {
  const [drag, setDrag] = useState<DragState>({ dragId: null, hint: null });

  const value: TreeContext = { tree, selectedId, onSelect, onAddChild, drag, setDrag };

  return (
    <Ctx.Provider value={value}>
      <div role="tree" aria-label="Notes" onDragEnd={() => setDrag({ dragId: null, hint: null })}>
        {tree.forest.map((node, index) => (
          <NoteTreeRow key={node.note.id} node={node} siblings={tree.forest} index={index} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function NoteTreeRow({ node, siblings, index, parent }: { node: TreeNode; siblings: TreeNode[]; index: number; parent?: TreeNode }) {
  const { tree, selectedId, onSelect, onAddChild, drag, setDrag } = useTreeCtx();
  const { note, depth, children } = node;

  const hasChildren = children.length > 0;
  const collapsed = tree.collapsed.has(note.id);
  const selected = note.id === selectedId;
  const hint = drag.hint?.id === note.id ? drag.hint.pos : null;
  const dragging = drag.dragId === note.id;
  const moves = treeMoveOptions(siblings, index, parent);
  const keyMoves: Record<string, TreeMoveOptionId> = { ArrowUp: 'up', ArrowDown: 'down', ArrowRight: 'indent', ArrowLeft: 'outdent' };

  // Chevron column keeps a fixed width so titles line up whether or not a row
  // has children; each level adds a small indent.
  const indent = 4 + depth * 13;

  const onDragStart = (e: DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(note.id));
    setDrag({ dragId: note.id, hint: null });
  };

  const onDragOver = (e: DragEvent) => {
    if (drag.dragId == null || drag.dragId === note.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const pos: DropPos = y < rect.height * 0.3 ? 'before' : y > rect.height * 0.7 ? 'after' : 'inside';
    if (drag.hint?.id !== note.id || drag.hint.pos !== pos) {
      setDrag({ dragId: drag.dragId, hint: { id: note.id, pos } });
    }
  };

  const onDrop = (e: DragEvent) => {
    if (drag.dragId == null || drag.dragId === note.id) return;
    e.preventDefault();
    e.stopPropagation();
    tree.move(drag.dragId, note.id, hint ?? 'inside');
    setDrag({ dragId: null, hint: null });
  };

  return (
    <div>
      <div className="relative">
        {hint === 'before' && <DropLine className="top-0" style={{ left: indent + 16 }} />}
        {hint === 'after' && <DropLine className="bottom-0" style={{ left: indent + 16 }} />}
        <div
          role="treeitem"
          tabIndex={0}
          aria-label={note.title || 'Untitled Note'}
          aria-selected={selected}
          aria-expanded={hasChildren ? !collapsed : undefined}
          draggable
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onClick={() => onSelect(note.id)}
          onKeyDown={(e) => {
            if (e.altKey && keyMoves[e.key]) {
              const option = moves.find((candidate) => candidate.id === keyMoves[e.key]);
              e.preventDefault();
              if (option) tree.move(note.id, option.target, option.pos);
              return;
            }
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(note.id);
            } else if (e.key === 'ArrowRight' && hasChildren && collapsed) {
              e.preventDefault();
              tree.expand(note.id);
            } else if (e.key === 'ArrowLeft' && hasChildren && !collapsed) {
              e.preventDefault();
              tree.toggle(note.id);
            }
          }}
          style={{ paddingLeft: indent }}
          className={cn(
            'group/row flex w-full cursor-pointer items-center gap-0.5 rounded-md py-1 pr-1.5 text-left transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
            // A 26px row is a comfortable desktop list and an unusable phone
            // one: three of them fit inside a fingertip.
            'coarse:min-h-touch coarse:gap-1 coarse:rounded-lg coarse:py-2 coarse:pr-1 coarse:active:bg-surface-2',
            selected ? 'bg-surface-3' : 'hover:bg-surface-2',
            dragging && 'opacity-40',
            hint === 'inside' && 'bg-primary/10 ring-1 ring-inset ring-primary/60',
          )}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                tree.toggle(note.id);
              }}
              aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${note.title || 'Untitled Note'}`}
              tabIndex={-1}
              className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground coarse:h-11 coarse:w-7 coarse:rounded-lg"
            >
              <ChevronRight
                aria-hidden="true"
                className={cn('size-3 transition-transform coarse:size-4', !collapsed && 'rotate-90')}
              />
            </button>
          ) : (
            <span className="size-4 shrink-0 coarse:h-11 coarse:w-7" aria-hidden="true" />
          )}

          <span
            className={cn(
              'min-w-0 flex-1 truncate text-[13px] coarse:text-[15px]',
              selected ? 'font-medium text-foreground' : 'text-subtle-foreground',
            )}
          >
            {note.title || 'Untitled Note'}
          </span>

          {isAnchored(note) && (
            <span
              className="size-[5px] shrink-0 rounded-full bg-success"
              role="img"
              aria-label="Anchored on-chain"
            />
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(note.id);
            }}
            aria-label={`Add subnote to ${note.title || 'Untitled Note'}`}
            title="Add subnote"
            tabIndex={-1}
            /* Revealed on hover, which touch does not have: on a phone the
               control was present, invisible and 16px across. */
            className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100 coarse:h-11 coarse:w-11 coarse:rounded-full coarse:opacity-100 coarse:active:bg-surface-3"
          >
            <Plus className="size-3 coarse:size-4" aria-hidden="true" />
          </button>
          {moves.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Move ${note.title || 'Untitled Note'}`}
                  title="Move (Alt+Arrow keys)"
                  tabIndex={-1}
                  className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100 data-[state=open]:opacity-100 coarse:h-11 coarse:w-11 coarse:rounded-full coarse:opacity-100 coarse:active:bg-surface-3"
                >
                  <MoreVertical className="size-3 coarse:size-4" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                {moves.map((option) => (
                  <DropdownMenuItem key={option.id} onSelect={() => tree.move(note.id, option.target, option.pos)}>
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {hasChildren && !collapsed && children.map((child, childIndex) => (
        <NoteTreeRow key={child.note.id} node={child} siblings={children} index={childIndex} parent={node} />
      ))}
    </div>
  );
}

/** Thin accent line marking a before/after drop target. */
function DropLine({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={cn('pointer-events-none absolute right-1.5 z-10 h-0.5 rounded-full bg-primary', className)}
    />
  );
}
