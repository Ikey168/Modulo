// Canvas - a freeform, pan-and-zoom board where note cards are arranged
// spatially and connected. The pan/zoom/drag interaction mirrors the knowledge
// graph's `view {x,y,k}` transform, but cards are DOM nodes (they carry text
// and buttons) laid out in a scaled "world" layer, with connections drawn as
// SVG lines in the same world coordinates so they track pan and zoom for free.
//
// Layout (cards and connections) persists per board in localStorage; several
// named boards can coexist and the last-open one is restored on reload.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Frame, Maximize2, Minus, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/ui';
import type { CoreNote } from '@modulo/core';
import { relativeTime } from './workspaceUtils';
import {
  addBoard,
  addCard,
  addConnection,
  loadCanvasState,
  moveCard,
  removeBoard,
  removeCard,
  removeConnection,
  renameBoard,
  saveCanvasState,
  setActiveBoard,
  updateBoard,
  type CanvasBoard,
  type CanvasState,
} from './canvasStore';

interface View {
  x: number;
  y: number;
  k: number;
}

const CARD_W = 190;
const CARD_H = 66;
const MIN_K = 0.3;
const MAX_K = 2.5;
const GRID = 44;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface CanvasViewProps {
  notes: CoreNote[];
  /** Open a note in the notes view (switches view and selects it). */
  onOpenNote: (id: number) => void;
}

export function CanvasView({ notes, onOpenNote }: CanvasViewProps) {
  const [state, setState] = useState<CanvasState>(() => loadCanvasState());
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [selectedConn, setSelectedConn] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<{ from: number; x: number; y: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const dragRef = useRef<{ noteId: number; offX: number; offY: number } | null>(null);
  const didInit = useRef(false);

  const board = state.boards.find((b) => b.id === state.activeId) ?? state.boards[0];

  const noteById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  // Only render cards/connections whose notes still exist (a note may have been
  // deleted from the workspace). The stored layout is left untouched.
  const cards = useMemo(() => board.cards.filter((c) => noteById.has(c.noteId)), [board.cards, noteById]);
  const cardById = useMemo(() => new Map(cards.map((c) => [c.noteId, c])), [cards]);
  const connections = useMemo(
    () => board.connections.filter((c) => cardById.has(c.from) && cardById.has(c.to)),
    [board.connections, cardById],
  );
  const available = useMemo(
    () => notes.filter((n) => !board.cards.some((c) => c.noteId === n.id)),
    [notes, board.cards],
  );

  // Persist, debounced so a card drag (many state updates) writes once it ends.
  useEffect(() => {
    const t = setTimeout(() => saveCanvasState(state), 150);
    return () => clearTimeout(t);
  }, [state]);

  const mutateActive = (fn: (b: CanvasBoard) => CanvasBoard) =>
    setState((s) => {
      const id = s.boards.some((b) => b.id === s.activeId) ? s.activeId : s.boards[0].id;
      return updateBoard(s, id, fn);
    });

  const toWorld = (clientX: number, clientY: number) => {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (clientX - r.left - view.x) / view.k, y: (clientY - r.top - view.y) / view.k };
  };

  // Wheel zoom (attached natively so preventDefault is honoured).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      setView((v) => {
        const k2 = clamp(v.k * Math.exp(-e.deltaY * 0.0015), MIN_K, MAX_K);
        return { k: k2, x: mx - (mx - v.x) * (k2 / v.k), y: my - (my - v.y) * (k2 / v.k) };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Frame the board once on first layout: fit to cards, or centre the origin.
  useEffect(() => {
    if (didInit.current) return;
    const el = containerRef.current;
    const r = el?.getBoundingClientRect();
    if (!r || !r.width) return;
    didInit.current = true;
    fitView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length]);

  // Delete key removes the selected connection (unless typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (!selectedConn) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      mutateActive((b) => removeConnection(b, selectedConn));
      setSelectedConn(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConn]);

  function fitView() {
    const el = containerRef.current;
    const r = el?.getBoundingClientRect();
    if (!r || !r.width) return;
    if (cards.length === 0) {
      setView({ x: r.width / 2, y: r.height / 2, k: 1 });
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of cards) {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x + CARD_W);
      maxY = Math.max(maxY, c.y + CARD_H);
    }
    const pad = 80;
    const bw = Math.max(maxX - minX, 1);
    const bh = Math.max(maxY - minY, 1);
    const k = clamp(Math.min((r.width - pad * 2) / bw, (r.height - pad * 2) / bh), MIN_K, 1.4);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setView({ k, x: r.width / 2 - cx * k, y: r.height / 2 - cy * k });
  }

  const zoomBy = (factor: number) => {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return;
    const mx = r.width / 2;
    const my = r.height / 2;
    setView((v) => {
      const k2 = clamp(v.k * factor, MIN_K, MAX_K);
      return { k: k2, x: mx - (mx - v.x) * (k2 / v.k), y: my - (my - v.y) * (k2 / v.k) };
    });
  };

  const addNoteToCanvas = (noteId: number) => {
    const r = containerRef.current?.getBoundingClientRect();
    const cx = r ? (r.width / 2 - view.x) / view.k : 0;
    const cy = r ? (r.height / 2 - view.y) / view.k : 0;
    const jitter = () => (Math.random() - 0.5) * 48;
    mutateActive((b) => addCard(b, noteId, cx - CARD_W / 2 + jitter(), cy - CARD_H / 2 + jitter()));
  };

  // ── Background pan ─────────────────────────────────────────────────────────
  const onBgPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setSelectedConn(null);
    const el = containerRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    panRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
  };
  const onBgPointerMove = (e: React.PointerEvent) => {
    if (!panRef.current.active) return;
    const dx = e.clientX - panRef.current.lastX;
    const dy = e.clientY - panRef.current.lastY;
    panRef.current.lastX = e.clientX;
    panRef.current.lastY = e.clientY;
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };
  const onBgPointerUp = (e: React.PointerEvent) => {
    panRef.current.active = false;
    try {
      containerRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  // ── Card drag ──────────────────────────────────────────────────────────────
  const onCardPointerDown = (e: React.PointerEvent, noteId: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const c = board.cards.find((x) => x.noteId === noteId);
    if (!c) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const w = toWorld(e.clientX, e.clientY);
    dragRef.current = { noteId, offX: w.x - c.x, offY: w.y - c.y };
  };
  const onCardPointerMove = (e: React.PointerEvent, noteId: number) => {
    const d = dragRef.current;
    if (!d || d.noteId !== noteId) return;
    const w = toWorld(e.clientX, e.clientY);
    mutateActive((b) => moveCard(b, noteId, w.x - d.offX, w.y - d.offY));
  };
  const onCardPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  // ── Connection drag (from a card's connect handle) ─────────────────────────
  const onHandlePointerDown = (e: React.PointerEvent, noteId: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const w = toWorld(e.clientX, e.clientY);
    setConnecting({ from: noteId, x: w.x, y: w.y });
  };
  const onHandlePointerMove = (e: React.PointerEvent) => {
    if (!connecting) return;
    const w = toWorld(e.clientX, e.clientY);
    setConnecting((c) => (c ? { ...c, x: w.x, y: w.y } : c));
  };
  const onHandlePointerUp = (e: React.PointerEvent) => {
    if (connecting) {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-card-note-id]');
      const toId = el ? Number(el.getAttribute('data-card-note-id')) : null;
      if (toId != null && !Number.isNaN(toId)) {
        mutateActive((b) => addConnection(b, connecting.from, toId));
      }
      setConnecting(null);
    }
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  // ── Board actions ──────────────────────────────────────────────────────────
  const createBoard = () => setState((s) => addBoard(s, `Canvas ${s.boards.length + 1}`));
  const openRename = () => {
    setRenameValue(board.name);
    setRenameOpen(true);
  };
  const commitRename = () => {
    const name = renameValue.trim();
    if (name) setState((s) => renameBoard(s, s.activeId, name));
    setRenameOpen(false);
  };
  const confirmDelete = () => {
    setState((s) => removeBoard(s, s.activeId));
    setDeleteOpen(false);
  };

  const selectedConnObj = connections.find((c) => c.id === selectedConn) ?? null;

  return (
    <div className="flex flex-1 animate-fade-in flex-col overflow-hidden bg-background">
      {/* Toolbar: board switcher + actions on the left, add-note on the right. */}
      <header className="flex h-11 shrink-0 items-center gap-1.5 border-b border-border px-3">
        <Frame className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <Select value={board.id} onValueChange={(id) => setState((s) => setActiveBoard(s, id))}>
          <SelectTrigger className="h-8 w-auto min-w-[8rem] gap-2 border-none bg-transparent px-1.5 font-medium shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {state.boards.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Canvas actions">
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            <DropdownMenuItem onClick={createBoard}>
              <Plus className="size-4" aria-hidden="true" />
              New canvas
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openRename}>
              <Pencil className="size-4" aria-hidden="true" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setDeleteOpen(true)}
              disabled={state.boards.length <= 1}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center gap-2.5">
          <span className="hidden text-xxs tabular-nums text-muted-foreground sm:inline">
            {cards.length} {cards.length === 1 ? 'card' : 'cards'}
          </span>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Plus className="size-4" aria-hidden="true" />
                Add note
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-0">
              <Command>
                <CommandInput placeholder="Search notes..." />
                <CommandList>
                  <CommandEmpty>{available.length === 0 ? 'Every note is on this canvas.' : 'No matching notes.'}</CommandEmpty>
                  <CommandGroup>
                    {available.map((n) => (
                      <CommandItem
                        key={n.id}
                        value={`${n.title || 'Untitled'} ${n.id}`}
                        onSelect={() => {
                          addNoteToCanvas(n.id);
                          setPickerOpen(false);
                        }}
                      >
                        <span className="truncate">{n.title || 'Untitled'}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {/* Canvas surface */}
      <div
        ref={containerRef}
        className="relative flex-1 touch-none overflow-hidden bg-background"
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--border-strong) / 0.4) 1px, transparent 1px)',
          backgroundSize: `${GRID * view.k}px ${GRID * view.k}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
          cursor: panRef.current.active ? 'grabbing' : 'default',
        }}
        onPointerDown={onBgPointerDown}
        onPointerMove={onBgPointerMove}
        onPointerUp={onBgPointerUp}
        onPointerLeave={onBgPointerUp}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
        >
          {/* Connections (world coordinates; transform tracks pan/zoom). */}
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1} aria-hidden="true">
            {connections.map((cn) => {
              const a = cardById.get(cn.from)!;
              const b = cardById.get(cn.to)!;
              const x1 = a.x + CARD_W / 2;
              const y1 = a.y + CARD_H / 2;
              const x2 = b.x + CARD_W / 2;
              const y2 = b.y + CARD_H / 2;
              const sel = cn.id === selectedConn;
              return (
                <g key={cn.id}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth={16}
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setSelectedConn(cn.id);
                    }}
                  />
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={sel ? 'hsl(var(--primary))' : 'hsl(var(--border-strong))'}
                    strokeWidth={sel ? 2.5 : 1.5}
                    vectorEffect="non-scaling-stroke"
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              );
            })}
            {connecting && cardById.get(connecting.from) && (
              <line
                x1={cardById.get(connecting.from)!.x + CARD_W / 2}
                y1={cardById.get(connecting.from)!.y + CARD_H / 2}
                x2={connecting.x}
                y2={connecting.y}
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {/* Cards */}
          {cards.map((c) => {
            const note = noteById.get(c.noteId)!;
            return (
              <div
                key={c.noteId}
                data-card-note-id={c.noteId}
                onPointerDown={(e) => onCardPointerDown(e, c.noteId)}
                onPointerMove={(e) => onCardPointerMove(e, c.noteId)}
                onPointerUp={onCardPointerUp}
                onDoubleClick={() => onOpenNote(c.noteId)}
                className="group absolute flex cursor-grab select-none flex-col rounded-lg border border-border bg-surface p-2.5 shadow-sm transition-shadow hover:border-border-strong hover:shadow-md active:cursor-grabbing"
                style={{ left: c.x, top: c.y, width: CARD_W, minHeight: CARD_H }}
                title="Double-click to open"
              >
                <div className="flex items-start gap-1">
                  <span className="line-clamp-2 flex-1 text-xs font-medium leading-snug text-foreground">
                    {note.title || 'Untitled'}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove from canvas"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      mutateActive((b) => removeCard(b, c.noteId));
                    }}
                    className="-mr-1 -mt-1 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
                <span className="mt-auto pt-1.5 text-xxs text-muted-foreground">{relativeTime(note.updatedAt)}</span>

                {/* Connect handle: drag to another card to link them. */}
                <span
                  role="button"
                  aria-label="Drag to connect"
                  onPointerDown={(e) => onHandlePointerDown(e, c.noteId)}
                  onPointerMove={onHandlePointerMove}
                  onPointerUp={onHandlePointerUp}
                  className="absolute -right-1.5 top-1/2 size-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-surface bg-primary opacity-0 transition-opacity group-hover:opacity-100"
                />
              </div>
            );
          })}
        </div>

        {/* Floating delete control for a selected connection (screen space). */}
        {selectedConnObj &&
          (() => {
            const a = cardById.get(selectedConnObj.from)!;
            const b = cardById.get(selectedConnObj.to)!;
            const mx = (a.x + b.x) / 2 + CARD_W / 2;
            const my = (a.y + b.y) / 2 + CARD_H / 2;
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Remove connection"
                    onClick={() => {
                      mutateActive((bd) => removeConnection(bd, selectedConnObj.id));
                      setSelectedConn(null);
                    }}
                    style={{ left: mx * view.k + view.x, top: my * view.k + view.y }}
                    className="absolute z-10 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground shadow-md transition-colors hover:border-destructive hover:text-destructive"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Remove connection</TooltipContent>
              </Tooltip>
            );
          })()}

        {/* Empty state */}
        {cards.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
            <EmptyState
              icon={<Frame className="size-5" />}
              title="Empty canvas"
              description="Add notes and arrange them spatially. Drag a card to move it, drag its handle to connect, double-click to open."
            />
          </div>
        )}

        {/* Zoom / fit controls */}
        <div className="absolute bottom-5 right-5 flex flex-col overflow-hidden rounded-lg border border-border bg-surface/90 backdrop-blur-md">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 rounded-none" onClick={() => zoomBy(1.3)} aria-label="Zoom in">
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Zoom in</TooltipContent>
          </Tooltip>
          <Separator />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 rounded-none" onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out">
                <Minus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Zoom out</TooltipContent>
          </Tooltip>
          <Separator />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 rounded-none" onClick={fitView} aria-label="Fit canvas to view">
                <Maximize2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Fit to view</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename canvas</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
            }}
            placeholder="Canvas name"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={commitRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{board.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the canvas and its layout. Your notes are not affected. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
