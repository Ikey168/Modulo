import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ListTree, Plus } from 'lucide-react';
import { Badge, Button, Input, Progress, Textarea, cn } from '@/ui';
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
import {
  Choice,
  ConfirmDelete,
  EmptyPanel,
  Fact,
  FactGrid,
  Field,
  FieldGroup,
  FilterChips,
  Panel,
  RecordSheet,
  SearchInput,
  StatusBadge,
  Toolbar,
  ViewShell,
} from './viewkit';
import { useEducationStore } from './useEducationStore';
import { PopoverEditor } from './EntryPopover';

const CHILD_TYPES: Record<LearningNodeType, LearningNodeType[]> = {
  Program: ['Course'],
  Course: ['Module', 'Lesson', 'Activity'],
  Module: ['Lesson', 'Activity'],
  Lesson: ['Activity'],
  Activity: [],
};

const LEARNING_TONE: Record<string, 'destructive' | 'warning'> = { dropped: 'destructive', paused: 'warning' };

/**
 * `removeLearningNode` drops the node's whole subtree along with every study
 * session and assignment attached to any of it, so the prompt must say so.
 */
function cascade(data: EducationData, id: string): string {
  const ids = new Set([id, ...descendantsOf(data.nodes, id).map((node) => node.id)]);
  const nested = ids.size - 1;
  const sessions = data.sessions.filter((session) => ids.has(session.nodeId)).length;
  const assignments = data.assignments.filter((assignment) => ids.has(assignment.nodeId)).length;
  return `Its ${nested} nested item${nested === 1 ? '' : 's'}, ${sessions} study session${
    sessions === 1 ? '' : 's'
  } and ${assignments} assignment${assignments === 1 ? '' : 's'} are deleted with it.`;
}

interface BranchProps {
  data: EducationData;
  parentId: string;
  level: number;
  /** Accessible name for the outermost `tree`. */
  label?: string;
  /** `null` means "no filter is active"; otherwise only these ids render. */
  visible: Set<string> | null;
  expandedOf: (id: string) => boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}

/**
 * One level of the curriculum tree. Rendered as real `tree`/`treeitem`
 * semantics with nested groups for indentation — the previous version faked
 * depth with an inline `paddingLeft` and showed a chevron that could not be
 * pressed.
 */
function CurriculumBranch({ data, parentId, level, label, visible, expandedOf, onToggle, onOpen, onRemove }: BranchProps) {
  const children = data.nodes
    .filter((node) => node.parentId === parentId)
    .filter((node) => visible === null || visible.has(node.id));
  if (children.length === 0) return null;
  return (
    <ul role={level === 1 ? 'tree' : 'group'} aria-label={label} className={cn(level > 1 && 'pl-4')}>
      {children.map((node) => {
        const hasChildren = data.nodes.some((child) => child.parentId === node.id);
        const expanded = hasChildren && expandedOf(node.id);
        return (
          <li key={node.id} role="treeitem" aria-level={level} aria-expanded={hasChildren ? expanded : undefined}>
            <div className="flex min-w-0 items-center gap-2 border-b border-border/60 px-2 py-1.5">
              {hasChildren ? (
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.title}`}
                  onClick={() => onToggle(node.id)}
                  className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {expanded ? (
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  )}
                </button>
              ) : (
                <span className="size-4 shrink-0" aria-hidden="true" />
              )}
              <Badge variant="secondary" className="shrink-0">
                {node.type}
              </Badge>
              <button
                type="button"
                onClick={() => onOpen(node.id)}
                className="min-w-0 flex-1 truncate rounded-sm text-left text-[13px] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {node.title}
              </button>
              {node.targetDate && (
                <span className="shrink-0 font-mono text-xxs text-muted-foreground">{node.targetDate}</span>
              )}
              <StatusBadge status={node.status} completedStatuses={['Completed']} overrides={LEARNING_TONE} />
              <ConfirmDelete
                itemName={node.title}
                itemLabel={node.type.toLowerCase()}
                onDelete={() => onRemove(node.id)}
                consequence={cascade(data, node.id)}
              />
            </div>
            {expanded && (
              <CurriculumBranch
                data={data}
                parentId={node.id}
                level={level + 1}
                visible={visible}
                expandedOf={expandedOf}
                onToggle={onToggle}
                onOpen={onOpen}
                onRemove={onRemove}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Curriculum-item fields, shared by the create form and the edit sheet. */
function CurriculumFields({
  draft,
  setDraft,
  types,
}: {
  draft: LearningNode;
  setDraft: (next: LearningNode) => void;
  types: LearningNodeType[];
}) {
  return (
    <>
      <FieldGroup legend="Item" columns={2}>
        <Field label="Title" className="sm:col-span-2">
          <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </Field>
        <Choice
          label="Type"
          value={draft.type}
          options={[...new Set<string>([...types, draft.type])]}
          onChange={(type) => setDraft({ ...draft, type: type as LearningNodeType })}
        />
        <Choice
          label="Status"
          value={draft.status}
          options={LEARNING_STATUSES}
          onChange={(status) => setDraft({ ...draft, status: status as LearningNode['status'] })}
        />
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
      <FieldGroup legend="Context" columns={1}>
        <Field label="Notes">
          <Textarea
            rows={4}
            value={draft.notes ?? ''}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value || undefined })}
          />
        </Field>
      </FieldGroup>
    </>
  );
}

export function EducationCurriculumView() {
  const [data, persist] = useEducationStore();
  const [rootId, setRootId] = useState('');
  const [parentId, setParentId] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<LearningNodeType>('Module');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [openId, setOpenId] = useState<string | null>(null);

  const roots = data.nodes.filter((node) => !node.parentId);
  const selectedRoot = data.nodes.find((node) => node.id === rootId && !node.parentId) ?? roots[0];
  const rootDescendants = useMemo(
    () => (selectedRoot ? descendantsOf(data.nodes, selectedRoot.id) : []),
    [data.nodes, selectedRoot],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle && status === 'all') return null;
    const parentOf = new Map(data.nodes.map((node) => [node.id, node.parentId]));
    const ids = new Set<string>();
    for (const node of rootDescendants) {
      const hit =
        (!needle || node.title.toLowerCase().includes(needle)) && (status === 'all' || node.status === status);
      if (!hit) continue;
      let cursor: string | undefined = node.id;
      while (cursor && !ids.has(cursor)) {
        ids.add(cursor);
        cursor = parentOf.get(cursor);
      }
    }
    return ids;
  }, [data.nodes, query, rootDescendants, status]);

  const possibleParents = selectedRoot
    ? [selectedRoot, ...rootDescendants].filter((node) => CHILD_TYPES[node.type].length > 0)
    : [];
  const actualParent = possibleParents.find((node) => node.id === parentId) ?? possibleParents[0];
  const allowedTypes = actualParent ? CHILD_TYPES[actualParent.type] : [];
  const actualType = allowedTypes.includes(type) ? type : allowedTypes[0];
  const progress = useMemo(() => (selectedRoot ? nodeProgress(data, selectedRoot.id) : 0), [data, selectedRoot]);

  const open = data.nodes.find((node) => node.id === openId) ?? null;
  const openParent = open?.parentId ? data.nodes.find((node) => node.id === open.parentId) : undefined;

  const save = (next: LearningNode) =>
    persist((current) => ({ ...current, nodes: current.nodes.map((node) => (node.id === next.id ? next : node)) }));
  const remove = (id: string) => {
    persist((current) => removeLearningNode(current, id));
    setOpenId((current) => (current === id ? null : current));
  };
  const add = () => {
    if (!title.trim() || !actualParent || !actualType) return;
    persist((current) => ({
      ...current,
      nodes: [
        ...current.nodes,
        {
          id: newEducationId('learning'),
          parentId: actualParent.id,
          type: actualType,
          title: title.trim(),
          status: 'Planned',
        },
      ],
    }));
    setCollapsed((current) => {
      const next = new Set(current);
      next.delete(actualParent.id);
      return next;
    });
    setTitle('');
  };
  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const expandedOf = (id: string) => visible !== null || !collapsed.has(id);
  const counts = (value: string) =>
    value === 'all' ? rootDescendants.length : rootDescendants.filter((node) => node.status === value).length;

  if (!selectedRoot) {
    return (
      <ViewShell title="Curriculum" icon={ListTree} subtitle="Program → Course → Module → Lesson → Activity">
        <EmptyPanel
          icon={ListTree}
          size="page"
          title="No course to structure"
          description="Create a program or course in Learning Core first."
        />
      </ViewShell>
    );
  }

  return (
    <ViewShell
      title="Curriculum"
      icon={ListTree}
      subtitle="Program → Course → Module → Lesson → Activity"
      actions={
        <PopoverEditor title="Add curriculum item">
          <Choice
            label="Parent item"
            value={actualParent?.id ?? ''}
            options={possibleParents.map((node) => ({ value: node.id, label: `${node.type}: ${node.title}` }))}
            onChange={(next) => {
              setParentId(next);
              const parent = possibleParents.find((node) => node.id === next);
              if (parent) setType(CHILD_TYPES[parent.type][0]);
            }}
          />
          <Choice
            label="Type"
            value={actualType ?? ''}
            options={allowedTypes}
            onChange={(next) => setType(next as LearningNodeType)}
          />
          <Field label="Title">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && add()}
              placeholder="Curriculum item"
            />
          </Field>
          <Button onClick={add} disabled={!actualType || !title.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Add item
          </Button>
        </PopoverEditor>
      }
      toolbar={
        <Toolbar>
          <Choice
            label="Curriculum root"
            className="w-56"
            value={selectedRoot.id}
            options={roots.map((node) => ({ value: node.id, label: node.title || 'Untitled' }))}
            onChange={(next) => {
              setRootId(next);
              setParentId('');
            }}
          />
          <SearchInput value={query} onChange={setQuery} placeholder="Search curriculum…" label="Search curriculum" />
          <FilterChips
            label="Filter curriculum by status"
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
      <div className="mb-3 flex items-center gap-2">
        <Progress value={progress} className="h-1.5 flex-1" />
        <span className="shrink-0 text-xs text-muted-foreground">{progress}% complete</span>
      </div>

      <Panel
        title={selectedRoot.title}
        icon={ListTree}
        description={`${selectedRoot.type} · ${selectedRoot.status} · ${rootDescendants.length} item${
          rootDescendants.length === 1 ? '' : 's'
        }`}
        bodyClassName="p-0"
        actions={
          rootDescendants.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              disabled={visible !== null}
              onClick={() =>
                setCollapsed((current) =>
                  current.size > 0 ? new Set() : new Set(rootDescendants.map((node) => node.id)),
                )
              }
            >
              {collapsed.size > 0 ? 'Expand all' : 'Collapse all'}
            </Button>
          )
        }
      >
        {rootDescendants.length === 0 ? (
          <EmptyPanel
            icon={ListTree}
            title="No curriculum items yet"
            description="Break the course into modules, lessons and activities."
          />
        ) : visible !== null && visible.size === 0 ? (
          <EmptyPanel
            icon={ListTree}
            title="Nothing matches"
            description="No curriculum item matches this search and status filter."
            action={
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
            }
          />
        ) : (
          <CurriculumBranch
            data={data}
            parentId={selectedRoot.id}
            level={1}
            label={`Curriculum for ${selectedRoot.title}`}
            visible={visible}
            expandedOf={expandedOf}
            onToggle={toggle}
            onOpen={setOpenId}
            onRemove={remove}
          />
        )}
      </Panel>

      <RecordSheet
        record={open}
        onClose={() => setOpenId(null)}
        title={open?.title ?? ''}
        subtitle={openParent ? `In ${openParent.type} “${openParent.title}”` : undefined}
        badges={
          open && (
            <>
              <Badge variant="secondary">{open.type}</Badge>
              <StatusBadge status={open.status} completedStatuses={['Completed']} overrides={LEARNING_TONE} />
            </>
          )
        }
        renderEdit={(current, setCurrent) => (
          <CurriculumFields
            draft={current}
            setDraft={setCurrent}
            types={openParent ? CHILD_TYPES[openParent.type] : []}
          />
        )}
        onSave={save}
        actions={
          open && (
            <ConfirmDelete
              itemName={open.title}
              itemLabel={open.type.toLowerCase()}
              onDelete={() => remove(open.id)}
              consequence={cascade(data, open.id)}
            />
          )
        }
      >
        {open && (
          <FactGrid>
            <Fact label="Type" value={open.type} />
            <Fact label="Status" value={open.status} />
            <Fact label="Start date" value={open.startDate} />
            <Fact label="Target date" value={open.targetDate} emphasis />
            <Fact
              label="Nested items"
              value={`${descendantsOf(data.nodes, open.id).length} below this item`}
            />
            <Fact
              label="Study sessions"
              value={`${data.sessions.filter((session) => session.nodeId === open.id).length} logged`}
            />
            <Fact
              label="Notes"
              value={open.notes && <span className="whitespace-pre-wrap">{open.notes}</span>}
              wide
            />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}
