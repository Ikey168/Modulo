// Engagement pipeline board (#361): a Kanban of engagement notes moving
// through configurable stages. The stage lives as a `stage/…` tag on the note
// (visible outside the board); dragging a card between columns rewrites that
// tag. Open finding counts per engagement surface as severity badges when the
// Findings Tracker is installed (soft integration — the scan is local).
import { useMemo, useState, type DragEvent } from 'react';
import { Plus, SquareKanban, X } from 'lucide-react';
import { Button, cn, EmptyState, Input } from '@/ui';
import type { CoreNote } from '@modulo/core';
import type { WorkspaceViewProps } from './plugins/types';
import { extractFindings, severityRank, type NoteFinding } from './findings';
import { SEVERITY_BADGE } from './FindingCard';
import {
  engagementLabel,
  groupByStage,
  readStages,
  stageTag,
  STAGE_TAG_PREFIX,
  toStageId,
  writeStages,
} from './pipeline';

function openFindingsFor(all: NoteFinding[], engagement: string | null): NoteFinding[] {
  if (!engagement) return [];
  return all.filter(
    (f) => f.engagements.includes(`engagement/${engagement}`) && f.finding.status !== 'verified',
  );
}

function Card({
  note,
  findings,
  onOpen,
}: {
  note: CoreNote;
  findings: NoteFinding[];
  onOpen: () => void;
}) {
  const bySeverity = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of findings) m.set(f.finding.severity, (m.get(f.finding.severity) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => severityRank(a[0] as never) - severityRank(b[0] as never));
  }, [findings]);

  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', String(note.id))}
      onClick={onOpen}
      className="w-full cursor-grab rounded-md border border-border bg-surface p-2.5 text-left shadow-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
    >
      <div className="truncate text-sm font-medium">{note.title}</div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground">{engagementLabel(note)}</div>
      {bySeverity.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {bySeverity.map(([sev, count]) => (
            <span
              key={sev}
              className={cn(
                'rounded px-1 py-px text-xxs font-semibold uppercase',
                SEVERITY_BADGE[sev as keyof typeof SEVERITY_BADGE],
              )}
            >
              {count} {sev}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

export function PipelineView({ data, onOpenNote }: WorkspaceViewProps) {
  const [stages, setStages] = useState<string[]>(() => readStages());
  const [adding, setAdding] = useState(false);
  const [newColumn, setNewColumn] = useState('');
  const [dragOver, setDragOver] = useState<string | null>(null);

  const groups = useMemo(() => groupByStage(data.notes, stages), [data.notes, stages]);
  const allFindings = useMemo(() => extractFindings(data.notes), [data.notes]);
  const total = useMemo(() => Object.values(groups).reduce((n, g) => n + g.length, 0), [groups]);

  const moveTo = async (noteId: number, targetStage: string) => {
    const note = data.notes.find((n) => n.id === noteId);
    if (!note) return;
    const current = stageTag(note);
    if (current?.name === `${STAGE_TAG_PREFIX}${targetStage}`) return;
    if (current) await data.removeTag(note.id, current.id);
    await data.addTag(note.id, `${STAGE_TAG_PREFIX}${targetStage}`);
  };

  const onDrop = (stage: string) => (e: DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const id = Number(e.dataTransfer.getData('text/plain'));
    if (Number.isFinite(id)) void moveTo(id, stage);
  };

  const addColumn = () => {
    const id = toStageId(newColumn);
    if (!id || stages.includes(id)) return;
    const next = [...stages, id];
    setStages(next);
    writeStages(next);
    setNewColumn('');
    setAdding(false);
  };

  const removeColumn = (stage: string) => {
    // Only empty columns can be removed, so no engagement loses its home.
    if ((groups[stage] ?? []).length > 0 || stages.length <= 1) return;
    const next = stages.filter((s) => s !== stage);
    setStages(next);
    writeStages(next);
  };

  if (total === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <EmptyState
          icon={<SquareKanban className="size-5" />}
          title="No engagements on the board"
          description="Tag a note with engagement/<client>-<project> and it appears here. Its column is the note's stage/… tag."
        />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto p-3">
      {stages.map((stage) => (
        <div
          key={stage}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(stage);
          }}
          onDragLeave={() => setDragOver((s) => (s === stage ? null : s))}
          onDrop={onDrop(stage)}
          className={cn(
            'flex w-60 shrink-0 flex-col rounded-lg border bg-muted/30 transition-colors',
            dragOver === stage ? 'border-primary/60 bg-primary/5' : 'border-border',
          )}
        >
          <div className="flex items-center gap-1.5 px-2.5 py-2">
            <span className="text-xs font-semibold capitalize tracking-wide">{stage.replace(/-/g, ' ')}</span>
            <span className="text-xxs text-muted-foreground">{groups[stage]?.length ?? 0}</span>
            {(groups[stage]?.length ?? 0) === 0 && stages.length > 1 && (
              <button
                type="button"
                aria-label={`Remove column ${stage}`}
                onClick={() => removeColumn(stage)}
                className="ml-auto text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2 pt-0">
            {(groups[stage] ?? []).map((note) => (
              <Card
                key={note.id}
                note={note}
                findings={openFindingsFor(allFindings, engagementLabel(note))}
                onOpen={() => onOpenNote(note.id)}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="w-56 shrink-0">
        {adding ? (
          <div className="flex items-center gap-1.5">
            <Input
              autoFocus
              value={newColumn}
              placeholder="Column name"
              onChange={(e) => setNewColumn(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addColumn();
                if (e.key === 'Escape') setAdding(false);
              }}
              className="h-8 text-sm"
            />
            <Button size="sm" onClick={addColumn}>
              Add
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Add column
          </Button>
        )}
      </div>
    </div>
  );
}
