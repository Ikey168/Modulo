// Embedded database records synchronize by fence identity within the authenticated account.

import { useMemo } from 'react';
import { useDurableRecord } from './plugins/useDurableRecord';
import { DATABASE_PLUGIN_ID } from './plugins';
import { DATABASE_SCHEMA, DATABASE_LEGACY_KEY, validateDatabase, importLegacyDatabases } from './databaseSync';
import { slugify } from './outline';

export type ColumnKind = 'text' | 'number' | 'select' | 'checkbox' | 'date';
export type CellValue = string | number | boolean;

export interface Column {
  id: string;
  name: string;
  kind: ColumnKind;
  /** Choices for a `select` column. */
  options?: string[];
}

export interface Row {
  id: string;
  cells: Record<string, CellValue>;
}

export interface Database {
  view?: 'table' | 'board';
  id: string;
  title: string;
  columns: Column[];
  rows: Row[];
}

export interface ColumnSpec {
  name: string;
  kind: ColumnKind;
  options?: string[];
}

export interface DatabaseConfig {
  id: string;
  title: string;
  /** Columns to seed the database with on first use (block-defined). */
  seedColumns?: ColumnSpec[];
}

const KINDS: ColumnKind[] = ['text', 'number', 'select', 'checkbox', 'date'];

// ── Config parsing ───────────────────────────────────────────────────────────

/** `Status:select(Todo|Doing|Done)` or `Name:text` → a column spec. */
function parseColumnToken(token: string): ColumnSpec | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const colon = trimmed.indexOf(':');
  const name = (colon >= 0 ? trimmed.slice(0, colon) : trimmed).trim() || 'Column';
  let rest = (colon >= 0 ? trimmed.slice(colon + 1) : 'text').trim();

  let options: string[] | undefined;
  const sel = /^select\s*\(([^)]*)\)$/i.exec(rest);
  if (sel) {
    options = sel[1].split('|').map((o) => o.trim()).filter(Boolean);
    rest = 'select';
  }
  const kind = KINDS.includes(rest.toLowerCase() as ColumnKind) ? (rest.toLowerCase() as ColumnKind) : 'text';
  return { name, kind, options: kind === 'select' ? options ?? [] : undefined };
}

/** Parses the body of a ```database fence into an id / title / column seed. */
export function parseDatabaseConfig(source: string): DatabaseConfig {
  let id = '';
  let title = '';
  let seedColumns: ColumnSpec[] | undefined;

  for (const raw of (source || '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const val = line.slice(colon + 1).trim();
    if (key === 'id') id = slugify(val);
    else if (key === 'title') title = val;
    else if (key === 'columns') {
      const specs = val.split(',').map(parseColumnToken).filter((c): c is ColumnSpec => c != null);
      if (specs.length) seedColumns = specs;
    }
  }

  if (!id) id = title ? slugify(title) : 'untitled';
  if (!title) title = 'Untitled database';
  return { id, title, seedColumns };
}

// ── Construction & mutation (pure) ───────────────────────────────────────────

const DEFAULT_COLUMNS: ColumnSpec[] = [
  { name: 'Name', kind: 'text' },
  { name: 'Status', kind: 'select', options: ['Todo', 'In progress', 'Done'] },
];

/** Next `c3` / `r7`-style id: max numeric suffix in use, plus one. */
function nextId(prefix: string, items: { id: string }[]): string {
  let max = 0;
  for (const it of items) {
    const m = /(\d+)$/.exec(it.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${max + 1}`;
}

export function createDatabase(id: string, title: string, seed?: ColumnSpec[]): Database {
  const specs = seed && seed.length ? seed : DEFAULT_COLUMNS;
  const columns: Column[] = specs.map((s, i) => ({
    id: `c${i + 1}`,
    name: s.name,
    kind: s.kind,
    options: s.kind === 'select' ? s.options ?? [] : undefined,
  }));
  return { id, title, columns, rows: [] };
}

export function addColumn(db: Database, name: string, kind: ColumnKind): Database {
  const col: Column = {
    id: nextId('c', db.columns),
    name: name.trim() || 'Column',
    kind,
    options: kind === 'select' ? [] : undefined,
  };
  return { ...db, columns: [...db.columns, col] };
}

export function deleteColumn(db: Database, colId: string): Database {
  return {
    ...db,
    columns: db.columns.filter((c) => c.id !== colId),
    rows: db.rows.map((r) => {
      if (!(colId in r.cells)) return r;
      const cells = { ...r.cells };
      delete cells[colId];
      return { ...r, cells };
    }),
  };
}

export function renameColumn(db: Database, colId: string, name: string): Database {
  return {
    ...db,
    columns: db.columns.map((c) => (c.id === colId ? { ...c, name: name.trim() || c.name } : c)),
  };
}

export function setColumnKind(db: Database, colId: string, kind: ColumnKind): Database {
  return {
    ...db,
    columns: db.columns.map((c) =>
      c.id === colId ? { ...c, kind, options: kind === 'select' ? c.options ?? [] : undefined } : c,
    ),
  };
}

export function addSelectOption(db: Database, colId: string, option: string): Database {
  const value = option.trim();
  if (!value) return db;
  return {
    ...db,
    columns: db.columns.map((c) =>
      c.id === colId && c.kind === 'select' && !(c.options ?? []).includes(value)
        ? { ...c, options: [...(c.options ?? []), value] }
        : c,
    ),
  };
}

export function addRow(db: Database, preset: Record<string, CellValue> = {}): Database {
  const row: Row = { id: nextId('r', db.rows), cells: { ...preset } };
  return { ...db, rows: [...db.rows, row] };
}

export function deleteRow(db: Database, rowId: string): Database {
  return { ...db, rows: db.rows.filter((r) => r.id !== rowId) };
}

export function updateCell(db: Database, rowId: string, colId: string, value: CellValue): Database {
  return {
    ...db,
    rows: db.rows.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r)),
  };
}

export interface BoardGroup {
  value: string;
  rows: Row[];
}

/** Buckets rows by a select column's value for the board view; empties last. */
export function groupByColumn(db: Database, colId: string): BoardGroup[] {
  const col = db.columns.find((c) => c.id === colId);
  const groups: BoardGroup[] = (col?.options ?? []).map((o) => ({ value: o, rows: [] }));
  const byValue = new Map(groups.map((g) => [g.value, g]));
  const empty: BoardGroup = { value: '', rows: [] };
  for (const r of db.rows) {
    const v = r.cells[colId];
    const g = typeof v === 'string' ? byValue.get(v) : undefined;
    (g ?? empty).rows.push(r);
  }
  return [...groups, empty];
}

export function firstSelectColumn(db: Database): Column | undefined {
  return db.columns.find((c) => c.kind === 'select');
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface DatabaseApi {
  db: Database;
  sync: ReturnType<typeof useDurableRecord<Database>>;
  setView: (view: 'table' | 'board') => void;
  addRow: (preset?: Record<string, CellValue>) => void;
  deleteRow: (rowId: string) => void;
  updateCell: (rowId: string, colId: string, value: CellValue) => void;
  addColumn: (name: string, kind: ColumnKind) => void;
  deleteColumn: (colId: string) => void;
  renameColumn: (colId: string, name: string) => void;
  setColumnKind: (colId: string, kind: ColumnKind) => void;
  addSelectOption: (colId: string, option: string) => void;
}

export function useDatabase(source: string): DatabaseApi {
  const cfg = useMemo(() => parseDatabaseConfig(source), [source]);

  const initial = useMemo(() => createDatabase(cfg.id, cfg.title, cfg.seedColumns), [cfg]);
  const sync = useDurableRecord(DATABASE_PLUGIN_ID, `database.${cfg.id}`, DATABASE_SCHEMA, initial,
    value => { const db = validateDatabase(value); if (db.id !== cfg.id) throw new Error('Database fence identity mismatch'); return db; },
    DATABASE_LEGACY_KEY, client => importLegacyDatabases(client, localStorage));
  const update = sync.set;
  return {
    db: sync.value, sync,
    setView: view => update(db => ({ ...db, view })),
    addRow: preset => update(db => addRow(db, preset)),
    deleteRow: rowId => update(db => deleteRow(db, rowId)),
    updateCell: (rowId, colId, value) => update(db => updateCell(db, rowId, colId, value)),
    addColumn: (name, kind) => update(db => addColumn(db, name, kind)),
    deleteColumn: colId => update(db => deleteColumn(db, colId)),
    renameColumn: (colId, name) => update(db => renameColumn(db, colId, name)),
    setColumnKind: (colId, kind) => update(db => setColumnKind(db, colId, kind)),
    addSelectOption: (colId, option) => update(db => addSelectOption(db, colId, option)),
  };
}
