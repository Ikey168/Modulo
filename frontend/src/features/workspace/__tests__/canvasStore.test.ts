import { beforeEach, describe, expect, it } from 'vitest';
import {
  addBoard,
  addCard,
  addConnection,
  defaultState,
  emptyBoard,
  loadCanvasState,
  moveCard,
  removeBoard,
  removeCard,
  removeConnection,
  renameBoard,
  saveCanvasState,
  setActiveBoard,
} from '../canvasStore';

beforeEach(() => localStorage.clear());

describe('canvasStore - boards', () => {
  it('starts with a single active board', () => {
    const s = defaultState();
    expect(s.boards).toHaveLength(1);
    expect(s.activeId).toBe(s.boards[0].id);
  });

  it('adds a board and makes it active', () => {
    let s = defaultState();
    s = addBoard(s, 'Second');
    expect(s.boards).toHaveLength(2);
    expect(s.boards[1].name).toBe('Second');
    expect(s.activeId).toBe(s.boards[1].id);
  });

  it('renames a board', () => {
    let s = defaultState();
    s = renameBoard(s, s.activeId, 'Renamed');
    expect(s.boards[0].name).toBe('Renamed');
  });

  it('always keeps at least one board', () => {
    let s = defaultState();
    s = removeBoard(s, s.activeId); // no-op: last board
    expect(s.boards).toHaveLength(1);
  });

  it('reassigns the active board when the active one is removed', () => {
    let s = defaultState();
    const first = s.activeId;
    s = addBoard(s, 'Second'); // active is now the second board
    s = setActiveBoard(s, first);
    s = removeBoard(s, first);
    expect(s.boards).toHaveLength(1);
    expect(s.activeId).toBe(s.boards[0].id);
  });

  it('ignores setActive for an unknown board', () => {
    const s = defaultState();
    expect(setActiveBoard(s, 'nope').activeId).toBe(s.activeId);
  });
});

describe('canvasStore - cards and connections', () => {
  it('adds a card at most once per note', () => {
    let b = emptyBoard('B');
    b = addCard(b, 1, 10, 20);
    b = addCard(b, 1, 99, 99); // ignored: same note
    expect(b.cards).toHaveLength(1);
    expect(b.cards[0]).toMatchObject({ noteId: 1, x: 10, y: 20 });
  });

  it('moves a card', () => {
    let b = emptyBoard('B');
    b = addCard(b, 1, 0, 0);
    b = moveCard(b, 1, 50, 60);
    expect(b.cards[0]).toMatchObject({ x: 50, y: 60 });
  });

  it('removing a card also removes its connections', () => {
    let b = emptyBoard('B');
    b = addCard(b, 1, 0, 0);
    b = addCard(b, 2, 0, 0);
    b = addCard(b, 3, 0, 0);
    b = addConnection(b, 1, 2);
    b = addConnection(b, 2, 3);
    b = removeCard(b, 2);
    expect(b.cards.map((c) => c.noteId)).toEqual([1, 3]);
    expect(b.connections).toHaveLength(0);
  });

  it('dedupes connections in either direction and rejects self-links', () => {
    let b = emptyBoard('B');
    b = addCard(b, 1, 0, 0);
    b = addCard(b, 2, 0, 0);
    b = addConnection(b, 1, 2);
    b = addConnection(b, 2, 1); // duplicate
    b = addConnection(b, 1, 1); // self-link
    expect(b.connections).toHaveLength(1);
  });

  it('removes a connection by id', () => {
    let b = emptyBoard('B');
    b = addCard(b, 1, 0, 0);
    b = addCard(b, 2, 0, 0);
    b = addConnection(b, 1, 2);
    b = removeConnection(b, b.connections[0].id);
    expect(b.connections).toHaveLength(0);
  });
});

describe('canvasStore - persistence', () => {
  it('round-trips through localStorage', () => {
    let s = defaultState();
    s = renameBoard(s, s.activeId, 'Work');
    saveCanvasState(s);
    const loaded = loadCanvasState();
    expect(loaded.boards[0].name).toBe('Work');
    expect(loaded.activeId).toBe(s.activeId);
  });

  it('falls back to a default when storage is empty or corrupt', () => {
    expect(loadCanvasState().boards).toHaveLength(1);
    localStorage.setItem('modulo-canvas', '{ not json');
    expect(loadCanvasState().boards).toHaveLength(1);
  });

  it('normalizes an active id that no longer exists', () => {
    localStorage.setItem('modulo-canvas', JSON.stringify({ boards: [emptyBoard('A')], activeId: 'gone' }));
    const s = loadCanvasState();
    expect(s.activeId).toBe(s.boards[0].id);
  });
});
