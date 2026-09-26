import { useMemo, useState } from 'react';
import { ClipboardCheck, Plus } from 'lucide-react';
import { Badge, Button, Input, Textarea } from '@/ui';
import {
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_TYPES,
  newEducationId,
  type AssignmentType,
  type EducationAssignment,
  type LearningNode,
} from './education';
import {
  Choice,
  ConfirmDelete,
  EmptyPanel,
  Fact,
  FactGrid,
  Field,
  FieldGroup,
  FilterChips,
  ListRow,
  ListRows,
  Panel,
  RecordSheet,
  SearchInput,
  StatusBadge,
  Toolbar,
  ViewShell,
} from './viewkit';
import { isoDate } from './planner';
import { useEducationStore } from './useEducationStore';
import { PopoverEditor } from './EntryPopover';

type Filter = 'open' | 'overdue' | 'submitted' | 'graded' | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'graded', label: 'Graded' },
  { value: 'all', label: 'All' },
];

const blank = (): EducationAssignment => ({
  id: newEducationId('assignment'),
  nodeId: '',
  title: '',
  type: 'Assignment',
  status: 'Not Started',
});

const isOverdue = (assignment: EducationAssignment, today: string) =>
  Boolean(assignment.dueDate && assignment.dueDate < today && !['Submitted', 'Graded'].includes(assignment.status));

const matchesFilter = (assignment: EducationAssignment, filter: Filter, today: string) => {
  if (filter === 'all') return true;
  if (filter === 'graded') return assignment.status === 'Graded';
  if (filter === 'submitted') return assignment.status === 'Submitted';
  if (filter === 'overdue') return isOverdue(assignment, today);
  return !['Submitted', 'Graded'].includes(assignment.status);
};

const scoreLabel = (assignment: EducationAssignment) =>
  assignment.score === undefined && assignment.maxScore === undefined
    ? ''
    : `${assignment.score ?? '—'} / ${assignment.maxScore ?? '—'}`;

/** Assignment fields shared by the create form and the edit sheet. */
function AssignmentFields({
  draft,
  setDraft,
  nodes,
}: {
  draft: EducationAssignment;
  setDraft: (next: EducationAssignment) => void;
  nodes: LearningNode[];
}) {
  return (
    <>
      <FieldGroup legend="Work" columns={2}>
        <Field label="Title" className="sm:col-span-2">
          <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </Field>
        <Choice
          label="Learning item"
          className="sm:col-span-2"
          value={draft.nodeId}
          placeholder="Select a course"
          options={nodes.map((node) => ({ value: node.id, label: `${node.type}: ${node.title}` }))}
          onChange={(nodeId) => setDraft({ ...draft, nodeId })}
        />
        <Choice
          label="Type"
          value={draft.type}
          options={ASSIGNMENT_TYPES}
          onChange={(type) => setDraft({ ...draft, type: type as AssignmentType })}
        />
        <Choice
          label="Status"
          value={draft.status}
          options={ASSIGNMENT_STATUSES}
          onChange={(status) => setDraft({ ...draft, status: status as EducationAssignment['status'] })}
        />
      </FieldGroup>

      <FieldGroup legend="Dates" columns={2}>
        <Field label="Due date">
          <Input
            type="date"
            value={draft.dueDate ?? ''}
            onChange={(event) => setDraft({ ...draft, dueDate: event.target.value || undefined })}
          />
        </Field>
        <Field label="Submitted on">
          <Input
            type="date"
            value={draft.submittedAt ?? ''}
            onChange={(event) => setDraft({ ...draft, submittedAt: event.target.value || undefined })}
          />
        </Field>
      </FieldGroup>

      <FieldGroup legend="Grading" columns={2}>
        <Field label="Score">
          <Input
            type="number"
            min={0}
            value={draft.score ?? ''}
            onChange={(event) =>
              setDraft({ ...draft, score: event.target.value === '' ? undefined : Number(event.target.value) })
            }
          />
        </Field>
        <Field label="Maximum score">
          <Input
            type="number"
            min={0}
            value={draft.maxScore ?? ''}
            onChange={(event) =>
              setDraft({ ...draft, maxScore: event.target.value === '' ? undefined : Number(event.target.value) })
            }
          />
        </Field>
        <Field label="Feedback" className="sm:col-span-2">
          <Textarea
            rows={3}
            value={draft.feedback ?? ''}
            onChange={(event) => setDraft({ ...draft, feedback: event.target.value || undefined })}
          />
        </Field>
      </FieldGroup>
    </>
  );
}

export function EducationAssignmentsView() {
  const [data, persist] = useEducationStore();
  const [draft, setDraft] = useState(blank);
  const [filter, setFilter] = useState<Filter>('open');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const today = isoDate(new Date());

  const selectableNodes = data.nodes.filter((node) => node.status !== 'Dropped');
  const nodeTitle = (id: string) => data.nodes.find((node) => node.id === id)?.title ?? 'Missing course';
  const createDraft: EducationAssignment = {
    ...draft,
    nodeId: data.nodes.some((node) => node.id === draft.nodeId) ? draft.nodeId : selectableNodes[0]?.id ?? '',
  };

  const assignments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.assignments
      .filter((assignment) => matchesFilter(assignment, filter, today))
      .filter(
        (assignment) =>
          !needle ||
          `${assignment.title} ${assignment.feedback ?? ''} ${
            data.nodes.find((node) => node.id === assignment.nodeId)?.title ?? ''
          }`
            .toLowerCase()
            .includes(needle),
      )
      .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  }, [data.assignments, data.nodes, filter, query, today]);

  const open = data.assignments.find((assignment) => assignment.id === openId) ?? null;

  const add = () => {
    if (!createDraft.title.trim() || !createDraft.nodeId) return;
    persist((current) => ({
      ...current,
      assignments: [...current.assignments, { ...createDraft, title: createDraft.title.trim() }],
    }));
    setDraft(blank());
  };
  const save = (next: EducationAssignment) =>
    persist((current) => ({
      ...current,
      assignments: current.assignments.map((assignment) => (assignment.id === next.id ? next : assignment)),
    }));
  const remove = (id: string) =>
    persist((current) => ({ ...current, assignments: current.assignments.filter((item) => item.id !== id) }));

  const counts = (value: Filter) =>
    data.assignments.filter((assignment) => matchesFilter(assignment, value, today)).length;

  return (
    <ViewShell
      title="Assignments & Assessments"
      icon={ClipboardCheck}
      subtitle="Exercises, assignments, exams, projects, submissions, and grades."
      actions={
        selectableNodes.length > 0 && (
          <PopoverEditor title="Add assignment">
            <AssignmentFields draft={createDraft} setDraft={setDraft} nodes={selectableNodes} />
            <Button onClick={add} disabled={!createDraft.title.trim() || !createDraft.nodeId}>
              <Plus className="size-4" aria-hidden="true" />
              Add assignment
            </Button>
          </PopoverEditor>
        )
      }
      toolbar={
        <Toolbar>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search assignments…"
            label="Search assignments"
          />
          <FilterChips
            label="Filter assignments"
            value={filter}
            onChange={setFilter}
            options={FILTERS.map((item) => ({ ...item, count: counts(item.value) }))}
          />
        </Toolbar>
      }
    >
      {selectableNodes.length === 0 ? (
        <EmptyPanel
          icon={ClipboardCheck}
          size="page"
          title="No learning items"
          description="Create a course in Learning Core before adding assignments."
        />
      ) : (
        <Panel title="Assignments" icon={ClipboardCheck} bodyClassName="p-0">
          {assignments.length === 0 ? (
            <EmptyPanel
              icon={ClipboardCheck}
              title={data.assignments.length === 0 ? 'No assignments yet' : 'Nothing matches'}
              description={
                data.assignments.length === 0
                  ? 'Add the coursework you owe, then track submissions and grades here.'
                  : 'No assignment matches this search and filter.'
              }
              action={
                data.assignments.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setQuery('');
                      setFilter('all');
                    }}
                  >
                    Clear filters
                  </Button>
                )
              }
            />
          ) : (
            <ListRows>
              {assignments.map((assignment) => {
                const score = scoreLabel(assignment);
                return (
                  <ListRow
                    key={assignment.id}
                    title={assignment.title || 'Untitled assignment'}
                    openLabel={`Open ${assignment.title || 'untitled assignment'}`}
                    onOpen={() => setOpenId(assignment.id)}
                    detail={`${nodeTitle(assignment.nodeId)} · ${assignment.type}${
                      assignment.dueDate ? ` · due ${assignment.dueDate}` : ''
                    }`}
                    meta={
                      <>
                        {score && <span className="tabular-nums">{score}</span>}
                        {isOverdue(assignment, today) && <Badge variant="destructive">Overdue</Badge>}
                        <StatusBadge status={assignment.status} completedStatuses={['Graded']} />
                      </>
                    }
                    actions={
                      <ConfirmDelete
                        itemName={assignment.title}
                        itemLabel="assignment"
                        onDelete={() => remove(assignment.id)}
                        consequence="Its due date, score and feedback are removed."
                      />
                    }
                  />
                );
              })}
            </ListRows>
          )}
        </Panel>
      )}

      <RecordSheet
        record={open}
        onClose={() => setOpenId(null)}
        title={open?.title ?? ''}
        subtitle={open ? `${nodeTitle(open.nodeId)} · ${open.type}` : undefined}
        badges={
          open && (
            <>
              {isOverdue(open, today) && <Badge variant="destructive">Overdue</Badge>}
              <StatusBadge status={open.status} completedStatuses={['Graded']} />
            </>
          )
        }
        renderEdit={(current, setCurrent) => (
          <AssignmentFields draft={current} setDraft={setCurrent} nodes={selectableNodes} />
        )}
        onSave={save}
        actions={
          open && (
            <ConfirmDelete
              itemName={open.title}
              itemLabel="assignment"
              onDelete={() => {
                remove(open.id);
                setOpenId(null);
              }}
              consequence="Its due date, score and feedback are removed."
            />
          )
        }
      >
        {open && (
          <FactGrid>
            <Fact label="Learning item" value={nodeTitle(open.nodeId)} />
            <Fact label="Type" value={open.type} />
            <Fact label="Due date" value={open.dueDate} emphasis placeholder="No due date" />
            <Fact label="Submitted on" value={open.submittedAt} placeholder="Not submitted" />
            <Fact label="Score" value={scoreLabel(open)} placeholder="Not graded" />
            <Fact label="Status" value={open.status} />
            <Fact
              label="Feedback"
              value={open.feedback && <span className="whitespace-pre-wrap">{open.feedback}</span>}
              wide
              placeholder="No feedback recorded"
            />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}
