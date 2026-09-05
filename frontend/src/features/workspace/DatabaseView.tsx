// Renders a ```database fence as an interactive, Notion-style embedded database.
// Two views over the same rows: a typed table and a board grouped by a select
// column. All editing goes through the useDatabase hook, which persists to
// synchronized plugin state (see database.ts) — the note markdown only carries the id/title.

import { useState, type DragEvent } from 'react';
import { PluginStateNotice } from './plugins/PluginStateNotice';
import { Check, ChevronDown, GripVertical, LayoutGrid, Plus, Table as TableIcon, Trash2, X } from 'lucide-react';
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/ui';
import {
  firstSelectColumn,
  groupByColumn,
  useDatabase,
  type Column,
  type ColumnKind,
  type DatabaseApi,
  type Row,
} from './database';

const KIND_LABEL: Record<ColumnKind, string> = {
  text: 'Text',
  number: 'Number',
  select: 'Select',
  checkbox: 'Checkbox',
  date: 'Date',
};
const KIND_GLYPH: Record<ColumnKind, string> = {
  text: 'T',
  number: '#',
  select: '◇',
  checkbox: '☑',
  date: '☷',
};
const KINDS: ColumnKind[] = ['text', 'number', 'select', 'checkbox', 'date'];

// Stable, token-based pill colours cycled by option position.
const PILL_COLORS = [
  'bg-primary/15 text-primary-hover',
  'bg-warning/15 text-warning',
  'bg-success/15 text-success',
  'bg-destructive/15 text-destructive',
  'bg-surface-3 text-subtle-foreground',
];
function pillColor(col: Column, value: string): string {
  const i = (col.options ?? []).indexOf(value);
  return i < 0 ? PILL_COLORS[PILL_COLORS.length - 1] : PILL_COLORS[i % (PILL_COLORS.length - 1)];
}

function Pill({ col, value }: { col: Column; value: string }) {
  return <span className={cn('rounded px-1.5 py-0.5 text-[11px]', pillColor(col, value))}>{value}</span>;
}

const CELL_INPUT =
  'w-full bg-transparent px-2 py-1.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:bg-surface-2';

export function DatabaseView({ source }: { source: string }) {
  const api = useDatabase(source);
  const view = api.db.view ?? 'table';
  const setView = api.setView;
  const { db } = api;

  return (
    <div className="my-5 overflow-hidden rounded-lg border border-border bg-surface">
      <PluginStateNotice {...api.sync} />
      {api.sync.legacy && <div className="flex flex-wrap items-center gap-3 border-b px-3 py-2 text-sm">
        <span>Embedded databases are saved in this browser.</span>
        <Button size="sm" variant="outline" disabled={!api.sync.ready} onClick={() => void api.sync.importLegacy()}>Import into this account</Button>
        <Button size="sm" variant="ghost" onClick={api.sync.exportRecovery}>Export recovery data</Button>
      </div>}
      {api.sync.error && !api.sync.legacy && <Button variant="ghost" onClick={api.sync.exportRecovery}>Export recovery data</Button>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[13px] font-semibold text-foreground">{db.title}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {db.rows.length} {db.rows.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex items-center rounded-md border border-border p-0.5">
            <ViewButton active={view === 'table'} onClick={() => setView('table')} icon={<TableIcon className="size-3" />} label="Table" />
            <ViewButton active={view === 'board'} onClick={() => setView('board')} icon={<LayoutGrid className="size-3" />} label="Board" />
          </div>
          <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => api.addRow()}>
            <Plus className="size-3" aria-hidden="true" />
            New
          </Button>
        </div>
      </div>

      {db.columns.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">This database has no columns.</p>
      ) : view === 'table' ? (
        <TableView api={api} />
      ) : (
        <BoardView api={api} />
      )}
    </div>
  );
}

function ViewButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
        active ? 'bg-surface-3 text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Table view ───────────────────────────────────────────────────────────────

function TableView({ api }: { api: DatabaseApi }) {
  const { db } = api;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="w-8 border-b border-border bg-surface-3" aria-hidden="true" />
            {db.columns.map((col) => (
              <ColumnHeader key={col.id} api={api} col={col} />
            ))}
            <th className="w-9 border-b border-l border-border bg-surface-3 p-0">
              <button
                type="button"
                onClick={() => api.addColumn('Column', 'text')}
                aria-label="Add column"
                title="Add column"
                className="flex h-full w-full items-center justify-center py-2 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {db.rows.length === 0 ? (
            <tr>
              <td colSpan={db.columns.length + 2} className="px-3 py-6 text-center text-xs text-muted-foreground">
                No rows yet — add one below.
              </td>
            </tr>
          ) : (
            db.rows.map((row) => (
              <tr key={row.id} className="group/row">
                <td className="border-b border-border bg-surface/40 p-0 text-center align-middle">
                  <button
                    type="button"
                    onClick={() => api.deleteRow(row.id)}
                    aria-label="Delete row"
                    title="Delete row"
                    className="flex h-full w-full items-center justify-center py-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover/row:opacity-100"
                  >
                    <Trash2 className="size-3" aria-hidden="true" />
                  </button>
                </td>
                {db.columns.map((col) => (
                  <td key={col.id} className="border-b border-l border-border p-0 align-middle">
                    <Cell api={api} row={row} col={col} />
                  </td>
                ))}
                <td className="border-b border-l border-border bg-surface/40" aria-hidden="true" />
              </tr>
            ))
          )}
        </tbody>
      </table>
      <button
        type="button"
        onClick={() => api.addRow()}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        New row
      </button>
    </div>
  );
}

function ColumnHeader({ api, col }: { api: DatabaseApi; col: Column }) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(col.name);

  const commit = () => {
    api.renameColumn(col.id, draft);
    setRenaming(false);
  };

  return (
    <th className="min-w-[9rem] border-b border-l border-border bg-surface-3 p-0 text-left font-medium">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <span className="shrink-0 text-[10px] font-normal text-muted-foreground" aria-hidden="true">
          {KIND_GLYPH[col.kind]}
        </span>
        {renaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              else if (e.key === 'Escape') {
                setDraft(col.name);
                setRenaming(false);
              }
            }}
            aria-label="Column name"
            className="min-w-0 flex-1 rounded bg-surface px-1 py-0.5 text-[13px] text-foreground outline-none ring-1 ring-primary"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(col.name);
              setRenaming(true);
            }}
            className="min-w-0 flex-1 truncate text-left text-[13px] text-subtle-foreground hover:text-foreground"
            title="Rename column"
          >
            {col.name}
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`${col.name} column options`}
              className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <ChevronDown className="size-3" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuLabel className="text-xs">Property type</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={col.kind} onValueChange={(v) => api.setColumnKind(col.id, v as ColumnKind)}>
              {KINDS.map((k) => (
                <DropdownMenuRadioItem key={k} value={k} className="text-xs">
                  {KIND_LABEL[k]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-xs text-destructive focus:text-destructive"
              onClick={() => api.deleteColumn(col.id)}
            >
              <Trash2 className="size-3" aria-hidden="true" />
              Delete column
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </th>
  );
}

// ── Cell ─────────────────────────────────────────────────────────────────────

interface CellProps {
  api: DatabaseApi;
  row: Row;
  col: Column;
}

function Cell({ api, row, col }: CellProps) {
  const value = row.cells[col.id];

  if (col.kind === 'checkbox') {
    return (
      <div className="flex items-center justify-center py-1.5">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => api.updateCell(row.id, col.id, e.target.checked)}
          aria-label={col.name}
          className="size-3.5 accent-primary"
        />
      </div>
    );
  }

  if (col.kind === 'number') {
    return (
      <input
        type="number"
        value={value === '' || value == null ? '' : String(value)}
        onChange={(e) => api.updateCell(row.id, col.id, e.target.value === '' ? '' : Number(e.target.value))}
        aria-label={col.name}
        className={cn(CELL_INPUT, 'tabular-nums')}
      />
    );
  }

  if (col.kind === 'date') {
    return (
      <input
        type="date"
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => api.updateCell(row.id, col.id, e.target.value)}
        aria-label={col.name}
        className={CELL_INPUT}
      />
    );
  }

  if (col.kind === 'select') {
    return <SelectCell api={api} row={row} col={col} />;
  }

  return (
    <input
      type="text"
      value={typeof value === 'string' ? value : value == null ? '' : String(value)}
      onChange={(e) => api.updateCell(row.id, col.id, e.target.value)}
      aria-label={col.name}
      placeholder="Empty"
      className={CELL_INPUT}
    />
  );
}

// A themed picker (no OS-native <select>): colour chips, a checkmark on the
// current value, one-click clear, and an inline "add option" field.
function SelectCell({ api, row, col }: CellProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const value = typeof row.cells[col.id] === 'string' ? (row.cells[col.id] as string) : '';
  const options = col.options ?? [];

  const pick = (v: string) => {
    api.updateCell(row.id, col.id, v);
    setOpen(false);
  };
  const addOption = () => {
    const v = draft.trim();
    if (!v) return;
    api.addSelectOption(col.id, v);
    api.updateCell(row.id, col.id, v);
    setDraft('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={col.name}
          className="flex w-full items-center gap-1 px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
        >
          {value ? <Pill col={col} value={value} /> : <span className="text-[13px] text-muted-foreground">Empty</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1">
        <div className="max-h-56 overflow-y-auto">
          {options.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">No options yet.</p>}
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => pick(o)}
              className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left transition-colors hover:bg-surface-2"
            >
              <Pill col={col} value={o} />
              {o === value && <Check className="size-3 shrink-0 text-primary" aria-hidden="true" />}
            </button>
          ))}
          {value && (
            <button
              type="button"
              onClick={() => pick('')}
              className="mt-0.5 flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-surface-2"
            >
              <X className="size-3" aria-hidden="true" />
              Clear
            </button>
          )}
        </div>
        <div className="mt-1 border-t border-border pt-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addOption();
              }
            }}
            placeholder="Add option…"
            aria-label={`Add ${col.name} option`}
            className="w-full rounded bg-surface-2 px-2 py-1 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Board view ───────────────────────────────────────────────────────────────

function BoardView({ api }: { api: DatabaseApi }) {
  const { db } = api;
  const groupCol = firstSelectColumn(db);
  const [dragRow, setDragRow] = useState<string | null>(null);
  const [overValue, setOverValue] = useState<string | null>(null);

  if (!groupCol) {
    return (
      <p className="px-4 py-6 text-center text-xs text-muted-foreground">
        Add a <span className="text-foreground">Select</span> column to organise rows into a board.
      </p>
    );
  }

  const groups = groupByColumn(db, groupCol.id);
  const titleCol = db.columns.find((c) => c.kind === 'text') ?? db.columns[0];

  const resetDrag = () => {
    setDragRow(null);
    setOverValue(null);
  };
  const dropInto = (value: string) => {
    if (dragRow) api.updateCell(dragRow, groupCol.id, value);
    resetDrag();
  };

  return (
    <div className="flex gap-3 overflow-x-auto p-3" onDragEnd={resetDrag}>
      {groups.map((group) => (
        <div
          key={group.value || '__none__'}
          onDragOver={(e) => {
            if (dragRow == null) return;
            e.preventDefault();
            if (overValue !== group.value) setOverValue(group.value);
          }}
          onDrop={(e) => {
            e.preventDefault();
            dropInto(group.value);
          }}
          className={cn(
            'flex w-56 shrink-0 flex-col rounded-md p-1 transition-colors',
            dragRow != null && overValue === group.value ? 'bg-surface-2 ring-1 ring-inset ring-primary/50' : '',
          )}
        >
          <div className="mb-2 flex items-center gap-2 px-0.5 pt-0.5">
            {group.value ? (
              <Pill col={groupCol} value={group.value} />
            ) : (
              <span className="text-[11px] text-muted-foreground">No {groupCol.name.toLowerCase()}</span>
            )}
            <span className="text-[11px] text-muted-foreground">{group.rows.length}</span>
          </div>

          <div className="flex flex-col gap-2">
            {group.rows.map((row) => (
              <BoardCard
                key={row.id}
                api={api}
                row={row}
                titleCol={titleCol}
                groupCol={groupCol}
                dragging={dragRow === row.id}
                onDragStart={() => setDragRow(row.id)}
              />
            ))}
            <button
              type="button"
              onClick={() => api.addRow(group.value ? { [groupCol.id]: group.value } : {})}
              className="flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
            >
              <Plus className="size-3" aria-hidden="true" />
              New
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

interface BoardCardProps {
  api: DatabaseApi;
  row: Row;
  titleCol: Column;
  groupCol: Column;
  dragging: boolean;
  onDragStart: () => void;
}

function BoardCard({ api, row, titleCol, groupCol, dragging, onDragStart }: BoardCardProps) {
  // Fields shown on the card body: everything except the title and the column
  // the board is grouped by (that one is implied by the card's column).
  const fields = api.db.columns.filter((c) => c.id !== titleCol.id && c.id !== groupCol.id);

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.id);
    onDragStart();
  };

  return (
    <div className={cn('group/card rounded-md border border-border bg-surface-2 p-1.5', dragging && 'opacity-40')}>
      <div className="flex items-start gap-1">
        <button
          type="button"
          draggable
          onDragStart={handleDragStart}
          aria-label="Drag card to another column"
          title="Drag to move"
          className="mt-1.5 shrink-0 cursor-grab text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/card:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <Cell api={api} row={row} col={titleCol} />
        </div>
        <button
          type="button"
          onClick={() => api.deleteRow(row.id)}
          aria-label="Delete card"
          className="mt-1.5 flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover/card:opacity-100"
        >
          <Trash2 className="size-3" aria-hidden="true" />
        </button>
      </div>
      {fields.length > 0 && (
        <div className="mt-0.5 flex flex-col gap-0.5 pl-4">
          {fields.map((col) => (
            <div key={col.id} className="flex items-center gap-1.5 text-xs">
              <span className="w-14 shrink-0 truncate text-[10px] uppercase tracking-wide text-muted-foreground">{col.name}</span>
              <div className="min-w-0 flex-1">
                <Cell api={api} row={row} col={col} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
