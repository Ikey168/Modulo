import { useMemo, useState } from 'react';
import { GraduationCap, Plus } from 'lucide-react';
import { Badge, Button, Input, Progress, Textarea } from '@/ui';
import {
  CardGrid,
  Choice,
  ConfirmDelete,
  EmptyPanel,
  Fact,
  FactGrid,
  Field,
  FieldGroup,
  FilterChips,
  LinkOut,
  RecordCard,
  RecordSheet,
  SearchInput,
  StatusBadge,
  Toolbar,
  ViewShell,
} from './viewkit';
import {
  LEARNING_STATUSES,
  descendantsOf,
  newEducationId,
  nodeProgress,
  removeLearningNode,
  type EducationData,
  type LearningNode,
  type LearningNodeType,
} from './education';
import { useEducationStore } from './useEducationStore';
import { useParaStore } from './useParaStore';
import { PopoverEditor } from './EntryPopover';
import type { ParaData } from './para';

const ROOT_TYPES: LearningNodeType[] = ['Program', 'Course'];

const LEARNING_TONE: Record<string, 'destructive' | 'warning'> = { dropped: 'destructive', paused: 'warning' };

const blank = (): LearningNode => ({
  id: newEducationId('learning'),
  type: 'Course',
  title: '',
  status: 'Planned',
});

/**
 * `removeLearningNode` deletes the whole subtree plus everything attached to
 * it, so the confirm prompt has to say exactly how much goes with it.
 */
function cascade(data: EducationData, id: string): string {
  const ids = new Set([id, ...descendantsOf(data.nodes, id).map((node) => node.id)]);
  const nested = ids.size - 1;
  const sessions = data.sessions.filter((session) => ids.has(session.nodeId)).length;
  const assignments = data.assignments.filter((assignment) => ids.has(assignment.nodeId)).length;
  return `Its ${nested} nested curriculum item${nested === 1 ? '' : 's'}, ${sessions} study session${
    sessions === 1 ? '' : 's'
  } and ${assignments} assignment${assignments === 1 ? '' : 's'} are deleted with it.`;
}

/** Learning fields shared by the create form and the edit sheet. */
function LearningFields({
  draft,
  setDraft,
  para,
}: {
  draft: LearningNode;
  setDraft: (next: LearningNode) => void;
  para: ParaData;
}) {
  const typeOptions = [...new Set<string>([...ROOT_TYPES, draft.type])];
  return (
    <>
      <FieldGroup legend="Programme" columns={2}>
        <Field label="Title" className="sm:col-span-2">
          <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </Field>
        <Choice
          label="Type"
          value={draft.type}
          options={typeOptions}
          onChange={(type) => setDraft({ ...draft, type: type as LearningNodeType })}
        />
        <Choice
          label="Status"
          value={draft.status}
          options={LEARNING_STATUSES}
          onChange={(status) => setDraft({ ...draft, status: status as LearningNode['status'] })}
        />
        <Field label="Subject">
          <Input
            value={draft.subject ?? ''}
            onChange={(event) => setDraft({ ...draft, subject: event.target.value || undefined })}
          />
        </Field>
        <Field label="Provider or institution">
          <Input
            value={draft.provider ?? ''}
            onChange={(event) => setDraft({ ...draft, provider: event.target.value || undefined })}
          />
        </Field>
        <Field label="Instructor">
          <Input
            value={draft.instructor ?? ''}
            onChange={(event) => setDraft({ ...draft, instructor: event.target.value || undefined })}
          />
        </Field>
        <Field label="Source URL" hint="Syllabus, course page, or enrolment record.">
          <Input
            type="url"
            placeholder="https://…"
            value={draft.sourceUrl ?? ''}
            onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value || undefined })}
          />
        </Field>
      </FieldGroup>

      <FieldGroup legend="Schedule" columns={2}>
        <Field label="Start date">
          <Input
            type="date"
            value={draft.startDate ?? ''}
            onChange={(event) => setDraft({ ...draft, startDate: event.target.value || undefined })}
          />
        </Field>
        <Field label="Target date">
          <Input
            type="date"
            value={draft.targetDate ?? ''}
            onChange={(event) => setDraft({ ...draft, targetDate: event.target.value || undefined })}
          />
        </Field>
      </FieldGroup>

      <FieldGroup legend="PARA links" columns={2}>
        <Choice
          label="Project"
          value={draft.projectId ?? ''}
          clearable
          clearLabel="No project"
          placeholder="No project"
          options={para.projects
            .filter((item) => !item.archivedAt)
            .map((item) => ({ value: item.id, label: item.name }))}
          onChange={(projectId) => setDraft({ ...draft, projectId: projectId || undefined })}
        />
        <Choice
          label="Area"
          value={draft.areaId ?? ''}
          clearable
          clearLabel="No area"
          placeholder="No area"
          options={para.areas.filter((item) => !item.archivedAt).map((item) => ({ value: item.id, label: item.name }))}
          onChange={(areaId) => setDraft({ ...draft, areaId: areaId || undefined })}
        />
        <Choice
          label="Goal or arc"
          className="sm:col-span-2"
          value={draft.goalId ?? ''}
          clearable
          clearLabel="No goal"
          placeholder="No goal"
          options={para.goals.filter((item) => !item.archivedAt).map((item) => ({ value: item.id, label: item.title }))}
          onChange={(goalId) => setDraft({ ...draft, goalId: goalId || undefined })}
        />
      </FieldGroup>

      <FieldGroup legend="Context" columns={1}>
        <Field label="Notes" hint="Outcomes, syllabus, prerequisites, or context.">
          <Textarea
            rows={6}
            value={draft.notes ?? ''}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value || undefined })}
          />
        </Field>
      </FieldGroup>
    </>
  );
}

export function EducationCoreView() {
  const [data, persist] = useEducationStore();
  const [para] = useParaStore();
  const [draft, setDraft] = useState(blank);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('all');

  const roots = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.nodes
      .filter((node) => !node.parentId)
      .filter((node) => status === 'all' || node.status === status)
      .filter(
        (node) =>
          !needle ||
          `${node.title} ${node.subject ?? ''} ${node.provider ?? ''} ${node.instructor ?? ''}`
            .toLowerCase()
            .includes(needle),
      )
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [data.nodes, query, status]);

  const total = data.nodes.filter((node) => !node.parentId).length;
  const selected = data.nodes.find((node) => node.id === selectedId) ?? null;

  const add = () => {
    if (!draft.title.trim()) return;
    const node = { ...draft, title: draft.title.trim() };
    persist((current) => ({ ...current, nodes: [node, ...current.nodes] }));
    setDraft(blank());
    setSelectedId(node.id);
  };
  const save = (next: LearningNode) =>
    persist((current) => ({ ...current, nodes: current.nodes.map((node) => (node.id === next.id ? next : node)) }));
  const remove = (id: string) => {
    persist((current) => removeLearningNode(current, id));
    setSelectedId(null);
  };

  const counts = (value: string) =>
    value === 'all' ? total : data.nodes.filter((node) => !node.parentId && node.status === value).length;
  const paraName = (list: { id: string; name?: string; title?: string }[], id?: string) =>
    id ? (list.find((item) => item.id === id)?.name ?? list.find((item) => item.id === id)?.title) : undefined;

  const addForm = (
    <PopoverEditor title="Add course">
      <LearningFields draft={draft} setDraft={setDraft} para={para} />
      <Button onClick={add} disabled={!draft.title.trim()}>
        <Plus className="size-4" aria-hidden="true" />
        Add course
      </Button>
    </PopoverEditor>
  );

  return (
    <ViewShell
      title="Learning Core"
      icon={GraduationCap}
      subtitle="Programs and courses, their providers, schedule, and progress."
      actions={addForm}
      toolbar={
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search learning…" label="Search learning" />
          <FilterChips
            label="Filter learning by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All', count: counts('all') },
              ...LEARNING_STATUSES.map((value) => ({ value, label: value, count: counts(value) })),
            ]}
          />
        </Toolbar>
      }
    >
      {roots.length === 0 ? (
        <EmptyPanel
          icon={GraduationCap}
          size="page"
          title={total === 0 ? 'No learning yet' : 'No learning matches'}
          description={
            total === 0
              ? 'Add a program or course to track its provider, schedule and progress.'
              : 'No program or course matches this search and status filter.'
          }
          action={
            total === 0 ? (
              addForm
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setQuery('');
                  setStatus('all');
                }}
              >
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <CardGrid>
          {roots.map((node) => {
            const progress = nodeProgress(data, node.id);
            return (
              <RecordCard
                key={node.id}
                title={node.title}
                onOpen={() => setSelectedId(node.id)}
                badges={
                  <>
                    <Badge variant="secondary">{node.type}</Badge>
                    <StatusBadge status={node.status} completedStatuses={['Completed']} overrides={LEARNING_TONE} />
                  </>
                }
                detail={
                  <>
                    <p className="truncate">
                      {[node.subject, node.provider].filter(Boolean).join(' · ') || 'No subject or provider set'}
                    </p>
                    {node.targetDate && <p>Target {node.targetDate}</p>}
                  </>
                }
                footer={
                  <span className="flex items-center gap-2">
                    <Progress value={progress} className="h-1 flex-1" />
                    <span className="shrink-0 tabular-nums">{progress}%</span>
                  </span>
                }
                actions={
                  <ConfirmDelete
                    itemName={node.title}
                    itemLabel={node.type.toLowerCase()}
                    onDelete={() => remove(node.id)}
                    consequence={cascade(data, node.id)}
                  />
                }
              />
            );
          })}
        </CardGrid>
      )}

      <RecordSheet
        record={selected}
        onClose={() => setSelectedId(null)}
        title={selected?.title ?? ''}
        subtitle={selected ? [selected.subject, selected.provider].filter(Boolean).join(' · ') || undefined : undefined}
        badges={
          selected && (
            <>
              <Badge variant="secondary">{selected.type}</Badge>
              <StatusBadge status={selected.status} completedStatuses={['Completed']} overrides={LEARNING_TONE} />
            </>
          )
        }
        renderEdit={(current, setCurrent) => <LearningFields draft={current} setDraft={setCurrent} para={para} />}
        onSave={save}
        actions={
          selected && (
            <ConfirmDelete
              itemName={selected.title}
              itemLabel={selected.type.toLowerCase()}
              onDelete={() => remove(selected.id)}
              consequence={cascade(data, selected.id)}
            />
          )
        }
      >
        {selected && (
          <div className="grid gap-3">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span>Learning progress</span>
                <span className="tabular-nums text-muted-foreground">{nodeProgress(data, selected.id)}%</span>
              </div>
              <Progress value={nodeProgress(data, selected.id)} className="mt-1.5" />
            </div>
            <FactGrid>
              <Fact label="Subject" value={selected.subject} />
              <Fact label="Provider" value={selected.provider} />
              <Fact label="Instructor" value={selected.instructor} />
              <Fact label="Source" value={selected.sourceUrl && <LinkOut url={selected.sourceUrl} />} />
              <Fact label="Start date" value={selected.startDate} />
              <Fact label="Target date" value={selected.targetDate} emphasis />
              <Fact label="PARA project" value={paraName(para.projects, selected.projectId)} placeholder="No project" />
              <Fact label="PARA area" value={paraName(para.areas, selected.areaId)} placeholder="No area" />
              <Fact
                label="Goal or arc"
                value={paraName(para.goals, selected.goalId)}
                placeholder="No goal"
                wide
              />
              <Fact
                label="Notes"
                value={selected.notes && <span className="whitespace-pre-wrap">{selected.notes}</span>}
                wide
              />
            </FactGrid>
          </div>
        )}
      </RecordSheet>
    </ViewShell>
  );
}
