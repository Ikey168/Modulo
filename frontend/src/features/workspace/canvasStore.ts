// Pure Canvas board operations. The active view persists individual boards
// through the server-backed canvasSync client and its explicit migration path.
//
// The card/connection/board operations below are pure (state in, new state out)
// so the view can drive them through setState and they can be unit-tested
// without a DOM.

/** A note placed on a canvas at a world position. Keyed by note id, so a note
 *  appears at most once per canvas. */
export interface CanvasCard {
  noteId: number;
  x: number;
  y: number;
}

/** A user-drawn link between two cards (by note id). This is canvas-local
 *  layout, independent of note-to-note links in the knowledge graph. */
export interface CanvasConnection {
  id: string;
  from: number;
  to: number;
}

export interface CanvasBoard {
  id: string;
  name: string;
  cards: CanvasCard[];
  connections: CanvasConnection[];
}

export interface CanvasState {
  boards: CanvasBoard[];
  /** Id of the last-open board, restored on reload. */
  activeId: string;
}

// ── Ids ──────────────────────────────────────────────────────────────────────

let seq = 0;
/** A stable, collision-resistant id. Uses crypto.randomUUID where available and
 *  falls back to a monotonic counter for older or headless environments. */
export function newId(prefix: string): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch {
    /* fall through to the counter */
  }
  seq += 1;
  return `${prefix}_${seq}_${Math.floor(Math.random() * 1e9).toString(36)}`;
}

// ── Construction ───────────────────────────────────────────────────────────

export function emptyBoard(name: string): CanvasBoard {
  return { id: newId('cv'), name, cards: [], connections: [] };
}

export function defaultState(): CanvasState {
  const board = emptyBoard('Canvas 1');
  return { boards: [board], activeId: board.id };
}

// ── Board-level operations ───────────────────────────────────────────────────

export function updateBoard(state: CanvasState, id: string, fn: (b: CanvasBoard) => CanvasBoard): CanvasState {
  return { ...state, boards: state.boards.map((b) => (b.id === id ? fn(b) : b)) };
}

export function addBoard(state: CanvasState, name: string): CanvasState {
  const board = emptyBoard(name);
  return { boards: [...state.boards, board], activeId: board.id };
}

export function renameBoard(state: CanvasState, id: string, name: string): CanvasState {
  return updateBoard(state, id, (b) => ({ ...b, name }));
}

/** Remove a board, always keeping at least one. Reassigns the active board when
 *  the removed one was active. */
export function removeBoard(state: CanvasState, id: string): CanvasState {
  if (state.boards.length <= 1) return state;
  const boards = state.boards.filter((b) => b.id !== id);
  const activeId = state.activeId === id ? boards[0].id : state.activeId;
  return { boards, activeId };
}

export function setActiveBoard(state: CanvasState, id: string): CanvasState {
  return state.boards.some((b) => b.id === id) ? { ...state, activeId: id } : state;
}

// ── Card and connection operations (on a single board) ───────────────────────

export function addCard(board: CanvasBoard, noteId: number, x: number, y: number): CanvasBoard {
  if (board.cards.some((c) => c.noteId === noteId)) return board; // one card per note
  return { ...board, cards: [...board.cards, { noteId, x, y }] };
}

export function moveCard(board: CanvasBoard, noteId: number, x: number, y: number): CanvasBoard {
  return { ...board, cards: board.cards.map((c) => (c.noteId === noteId ? { ...c, x, y } : c)) };
}

/** Remove a card and any connections that touched it. */
export function removeCard(board: CanvasBoard, noteId: number): CanvasBoard {
  return {
    ...board,
    cards: board.cards.filter((c) => c.noteId !== noteId),
    connections: board.connections.filter((cn) => cn.from !== noteId && cn.to !== noteId),
  };
}

/** Add a connection, ignoring self-links and duplicates in either direction. */
export function addConnection(board: CanvasBoard, from: number, to: number): CanvasBoard {
  if (from === to) return board;
  const exists = board.connections.some(
    (c) => (c.from === from && c.to === to) || (c.from === to && c.to === from),
  );
  if (exists) return board;
  return { ...board, connections: [...board.connections, { id: newId('cn'), from, to }] };
}

export function removeConnection(board: CanvasBoard, id: string): CanvasBoard {
  return { ...board, connections: board.connections.filter((c) => c.id !== id) };
}
