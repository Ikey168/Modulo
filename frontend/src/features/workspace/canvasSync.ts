import type { PluginStateClient, StateJson } from '../../services/pluginStateClient';
import type { CanvasBoard, CanvasState } from './canvasStore';

export const CANVAS_SCHEMA = 'modulo.canvas.board';
export const LEGACY_CANVAS_KEY = 'modulo-canvas';
const MARKER = 'migration-browser-v1';
const json = (value: unknown): StateJson => JSON.parse(JSON.stringify(value)) as StateJson;
const idPattern = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,120}$/;

export function parseCanvasBoard(value: unknown): CanvasBoard {
  const board = value as CanvasBoard;
  if (!board || typeof board.id !== 'string' || !idPattern.test(board.id) || typeof board.name !== 'string' || board.name.length > 200
    || !Array.isArray(board.cards) || !Array.isArray(board.connections)
    || board.cards.some(card => !card || !Number.isSafeInteger(card.noteId) || card.noteId < 1
      || !Number.isFinite(card.x) || !Number.isFinite(card.y))
    || new Set(board.cards.map(card => card.noteId)).size !== board.cards.length) throw new Error('Invalid canvas board');
  const notes = new Set(board.cards.map(card => card.noteId));
  if (board.connections.some(connection => !connection || typeof connection.id !== 'string' || !idPattern.test(connection.id)
    || connection.from === connection.to || !notes.has(connection.from) || !notes.has(connection.to))
    || new Set(board.connections.map(connection => connection.id)).size !== board.connections.length) {
    throw new Error('Invalid canvas connections');
  }
  return { ...board, id: board.id, name: board.name, cards: board.cards.map(card => ({ ...card })),
    connections: board.connections.map(connection => ({ ...connection })) };
}

export function emptySyncedCanvas(): CanvasState {
  return { boards: [{ id: 'default', name: 'Canvas 1', cards: [], connections: [] }], activeId: 'default' };
}

export function readSyncedCanvas(client: PluginStateClient): CanvasState {
  const boards = client.list().filter(entry => entry.key.startsWith('board.')).map(entry => {
    if (entry.schemaId !== CANVAS_SCHEMA || entry.schemaVersion !== 1) throw new Error('Unsupported canvas version. Export the board for recovery.');
    return parseCanvasBoard(entry.value);
  });
  if (!boards.length) return emptySyncedCanvas();
  const preferred = client.get('active-board')?.value;
  return { boards, activeId: boards.some(board => board.id === preferred) ? preferred as string : boards[0].id };
}

/** Persist only changed boards, so a stale aggregate cannot delete a new board from another client. */
export async function saveCanvasDiff(client: PluginStateClient, previous: CanvasState, next: CanvasState): Promise<void> {
  for (const board of next.boards) {
    const validated = parseCanvasBoard(board);
    const prior = previous.boards.find(candidate => candidate.id === board.id);
    if (!prior || JSON.stringify(prior) !== JSON.stringify(validated)) {
      await client.set(`board.${board.id}`, json(validated), CANVAS_SCHEMA, 1);
    }
  }
  for (const board of previous.boards) {
    if (!next.boards.some(candidate => candidate.id === board.id)) await client.delete(`board.${board.id}`);
  }
  if (previous.activeId !== next.activeId) await client.set('active-board', next.activeId, 'modulo.canvas.preference', 1);
}

/** Called only after the signed-in user explicitly chooses to import browser-global legacy data. */
export async function importLegacyCanvas(client: PluginStateClient, storage: Storage): Promise<void> {
  const raw = storage.getItem(LEGACY_CANVAS_KEY);
  if (raw === null) return;
  const source = JSON.parse(raw) as CanvasState;
  if (!source || !Array.isArray(source.boards) || source.boards.length === 0) throw new Error('Invalid legacy canvas; export it for recovery');
  const boards = source.boards.map(parseCanvasBoard);
  if (new Set(boards.map(board => board.id)).size !== boards.length) throw new Error('Duplicate legacy board IDs');
  await client.refreshAll();
  for (const board of boards) {
    const key = `board.${board.id}`;
    const existing = client.get(key);
    if (existing && !existing.deleted) {
      if (existing.schemaId !== CANVAS_SCHEMA || existing.schemaVersion !== 1
        || JSON.stringify(parseCanvasBoard(existing.value)) !== JSON.stringify(board)) {
        throw new Error(`Canvas “${board.name}” differs on the server. Browser data has been preserved.`);
      }
    } else await client.create(key, json(board), CANVAS_SCHEMA, 1);
  }
  await client.synchronize();
  if (boards.some(board => client.get(`board.${board.id}`)?.pending || client.get(`board.${board.id}`)?.conflict)) {
    throw new Error('Canvas import has not synchronized. Browser data has been preserved.');
  }
  if (boards.some(board => board.id === source.activeId) && !client.get('active-board')) {
    await client.create('active-board', source.activeId, 'modulo.canvas.preference', 1);
    await client.synchronize();
    if (client.get('active-board')?.pending) throw new Error('Canvas preference has not synchronized');
  }
  await client.set(MARKER, { boardIds: boards.map(board => board.id) }, 'modulo.migration', 1);
  await client.synchronize();
  if (client.get(MARKER)?.pending || client.get(MARKER)?.conflict) throw new Error('Migration confirmation is pending');
  // Another tab may have edited the old store while this import was in progress.
  if (storage.getItem(LEGACY_CANVAS_KEY) === raw) storage.removeItem(LEGACY_CANVAS_KEY);
}
