import { describe, expect, it } from 'vitest';
import {
  addColumn,
  addRow,
  addSelectOption,
  createDatabase,
  deleteColumn,
  deleteRow,
  firstSelectColumn,
  groupByColumn,
  parseDatabaseConfig,
  renameColumn,
  setColumnKind,
  updateCell,
  type Database,
} from '../database';

describe('parseDatabaseConfig', () => {
  it('reads id and title, slugifying the id', () => {
    const cfg = parseDatabaseConfig('id: My Roadmap\ntitle: Product Roadmap');
    expect(cfg.id).toBe('my-roadmap');
    expect(cfg.title).toBe('Product Roadmap');
  });

  it('derives an id from the title when none is given', () => {
    expect(parseDatabaseConfig('title: Sprint Tasks').id).toBe('sprint-tasks');
  });

  it('falls back to "untitled" with no id or title', () => {
    const cfg = parseDatabaseConfig('');
    expect(cfg.id).toBe('untitled');
    expect(cfg.title).toBe('Untitled database');
  });

  it('parses a column seed including select options', () => {
    const cfg = parseDatabaseConfig('id: t\ncolumns: Name:text, Status:select(Todo|Done), Done:checkbox');
    expect(cfg.seedColumns).toEqual([
      { name: 'Name', kind: 'text', options: undefined },
      { name: 'Status', kind: 'select', options: ['Todo', 'Done'] },
      { name: 'Done', kind: 'checkbox', options: undefined },
    ]);
  });

  it('defaults an unknown column kind to text', () => {
    expect(parseDatabaseConfig('columns: Foo:banana').seedColumns?.[0]).toEqual({
      name: 'Foo',
      kind: 'text',
      options: undefined,
    });
  });
});

describe('createDatabase', () => {
  it('uses the default schema when no seed is given', () => {
    const db = createDatabase('x', 'X');
    expect(db.columns.map((c) => c.name)).toEqual(['Name', 'Status']);
    expect(firstSelectColumn(db)?.options).toEqual(['Todo', 'In progress', 'Done']);
    expect(db.rows).toEqual([]);
  });

  it('honours a provided column seed', () => {
    const db = createDatabase('x', 'X', [{ name: 'Task', kind: 'text' }]);
    expect(db.columns).toHaveLength(1);
    expect(db.columns[0]).toMatchObject({ id: 'c1', name: 'Task', kind: 'text' });
  });
});

function seed(): Database {
  return createDatabase('t', 'Tasks', [
    { name: 'Name', kind: 'text' },
    { name: 'Status', kind: 'select', options: ['Todo', 'Done'] },
  ]);
}

describe('row and cell mutation', () => {
  it('adds rows with unique incrementing ids and applies a preset', () => {
    let db = seed();
    db = addRow(db, { c1: 'First' });
    db = addRow(db);
    expect(db.rows.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(db.rows[0].cells.c1).toBe('First');
  });

  it('updates a single cell immutably', () => {
    let db = addRow(seed());
    const before = db.rows[0];
    db = updateCell(db, 'r1', 'c1', 'Hello');
    expect(db.rows[0].cells.c1).toBe('Hello');
    expect(before.cells.c1).toBeUndefined(); // original row object untouched
  });

  it('deletes a row', () => {
    let db = addRow(addRow(seed()));
    db = deleteRow(db, 'r1');
    expect(db.rows.map((r) => r.id)).toEqual(['r2']);
  });
});

describe('column mutation', () => {
  it('adds a column with the next id', () => {
    const db = addColumn(seed(), 'Priority', 'number');
    expect(db.columns[2]).toMatchObject({ id: 'c3', name: 'Priority', kind: 'number' });
  });

  it('deletes a column and drops its cells from every row', () => {
    let db = updateCell(addRow(seed()), 'r1', 'c2', 'Todo');
    db = deleteColumn(db, 'c2');
    expect(db.columns.map((c) => c.id)).toEqual(['c1']);
    expect('c2' in db.rows[0].cells).toBe(false);
  });

  it('renames a column but keeps a blank name', () => {
    expect(renameColumn(seed(), 'c1', 'Title').columns[0].name).toBe('Title');
    expect(renameColumn(seed(), 'c1', '   ').columns[0].name).toBe('Name');
  });

  it('changing kind away from select drops its options', () => {
    const db = setColumnKind(seed(), 'c2', 'text');
    expect(db.columns[1].kind).toBe('text');
    expect(db.columns[1].options).toBeUndefined();
  });

  it('adds a select option only once', () => {
    let db = addSelectOption(seed(), 'c2', 'Blocked');
    db = addSelectOption(db, 'c2', 'Blocked');
    expect(db.columns[1].options).toEqual(['Todo', 'Done', 'Blocked']);
  });
});

describe('groupByColumn', () => {
  it('buckets rows by select value with an empty group last', () => {
    let db = seed();
    db = updateCell(addRow(db), 'r1', 'c2', 'Todo');
    db = updateCell(addRow(db), 'r2', 'c2', 'Done');
    db = addRow(db); // r3 has no status
    const groups = groupByColumn(db, 'c2');
    expect(groups.map((g) => g.value)).toEqual(['Todo', 'Done', '']);
    expect(groups[0].rows.map((r) => r.id)).toEqual(['r1']);
    expect(groups[2].rows.map((r) => r.id)).toEqual(['r3']); // empty bucket
  });
});
