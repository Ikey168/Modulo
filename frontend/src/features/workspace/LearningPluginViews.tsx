import { useState, type ReactNode } from 'react';
import { GitBranch, NotebookPen, Plus } from 'lucide-react';
import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, Textarea } from '@/ui';
import type { WorkspaceViewProps } from './plugins/types';
import { DECISION_JOURNAL_PLUGIN_ID, SKILL_TREE_PLUGIN_ID } from './foundationTools';
import { lifeStoreKey, type LifeRecord } from './lifeStore';
import { useRemoveLifeOsRelations } from './useLifeOsRelations';
import { CrossPluginLinks } from './CrossPluginLinks';
import { useLearningCollection } from './useLearningCollection';
import { decisionIsDue, logSkillPractice, newLearningRecord, reviewDecision, skillBlockers, skillPrerequisites, validateDecision, validateSkill } from './learningTools';
import { Choice, ChoiceInline, ConfirmDelete, EmptyPanel, Fact, FactGrid, Field, ListRow, ListRows, RecordSheet, SearchInput, StatusBadge, ViewShell } from './viewkit';

type NoteWorkspace = Pick<WorkspaceViewProps, 'data' | 'onOpenNote'>;

export function SourceNoteLink({ record, workspace }: { record: LifeRecord; workspace?: NoteWorkspace }) {
  const id = Number(record.values.sourceNoteId);
  if (!record.values.sourceNoteId) return null;
  const note = workspace?.data.notes.find((item) => item.id === id);
  return note ? <Button variant="link" size="sm" onClick={() => workspace?.onOpenNote(note.id)}>Open source: {note.title}</Button>
    : <p className="text-xs text-muted-foreground">Source note unavailable: {record.values.sourceNoteTitle || id}</p>;
}

function SourceNoteChoice({ draft, setDraft, workspace }: { draft: LifeRecord; setDraft: (next: LifeRecord) => void; workspace: NoteWorkspace }) {
  return <Choice label="Source note" value={draft.values.sourceNoteId} clearable
    options={workspace.data.notes.map((note) => ({ value: String(note.id), label: note.title }))}
    onChange={(id) => setDraft({ ...draft, values: { ...draft.values, sourceNoteId: id, sourceNoteTitle: workspace.data.notes.find((note) => String(note.id) === id)?.title || '' } })} />;
}

function LearningEditor({ title, children, error, onClose, onSave, saveLabel = 'Save' }: {
  title: string; children: ReactNode; error: string; onClose: () => void; onSave: () => void; saveLabel?: string;
}) {
  return <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Changes are saved when you choose {saveLabel}.</DialogDescription></DialogHeader>
      <form onSubmit={(event) => { event.preventDefault(); onSave(); }} onKeyDown={(event) => {
        if (!event.nativeEvent.isComposing && (event.ctrlKey || event.metaKey) && !event.altKey && event.key === 'Enter') {
          event.preventDefault(); event.currentTarget.requestSubmit();
        }
      }} className="space-y-4">
        {children}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2 border-t border-border pt-3"><Button type="submit">{saveLabel}</Button><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}

function JournalHistory({ record }: { record: LifeRecord }) {
  return record.log.length > 0 ? <section className="mt-4"><h3 className="mb-2 text-sm font-medium">History</h3><ol className="divide-y divide-border">{record.log.map((entry) => <li key={entry.id} className="py-2 text-sm"><time className="text-xs text-muted-foreground">{entry.date}</time><p className="whitespace-pre-wrap">{entry.title}</p></li>)}</ol></section> : null;
}

export function DecisionJournalView(workspace: WorkspaceViewProps) {
  const { data, commit, error, setError } = useLearningCollection(DECISION_JOURNAL_PLUGIN_ID);
  const removeRelations = useRemoveLifeOsRelations();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LifeRecord | null>(null);
  const [reviewing, setReviewing] = useState<LifeRecord | null>(null);
  const [outcome, setOutcome] = useState('');
  const [lessons, setLessons] = useState('');
  const selected = data.records.find((record) => record.id === selectedId) ?? null;
  const due = data.records.filter((record) => decisionIsDue(record)).length;
  const records = data.records.filter((record) => (filter === 'All' || (filter === 'Due' ? decisionIsDue(record) : record.status === filter))
    && `${record.title} ${Object.values(record.values).join(' ')}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const start = () => { setError(''); setDraft(newLearningRecord('Pending review', 'Personal')); };
  const save = () => {
    if (!draft) return;
    if (commit((current) => {
      validateDecision(draft);
      return { ...current, records: current.records.some((record) => record.id === draft.id)
        ? current.records.map((record) => record.id === draft.id ? { ...record, ...draft, title: draft.title.trim() } : record)
        : [{ ...draft, title: draft.title.trim() }, ...current.records] };
    })) setDraft(null);
  };
  const finishReview = () => {
    if (!reviewing) return;
    if (commit((current) => {
      const record = current.records.find((item) => item.id === reviewing.id);
      if (!record) throw new Error('This decision was removed.');
      const reviewed = reviewDecision(record, outcome, lessons);
      return { ...current, records: current.records.map((item) => item.id === record.id ? reviewed : item) };
    })) setReviewing(null);
  };
  const remove = (record: LifeRecord) => {
    if (commit((current) => ({ ...current, records: current.records.filter((item) => item.id !== record.id) }))) {
      removeRelations(`${lifeStoreKey(DECISION_JOURNAL_PLUGIN_ID)}:records:${record.id}`);
      setSelectedId(null);
    }
  };
  return <ViewShell title="Decision Journal" icon={NotebookPen} subtitle={`${due} decision${due === 1 ? '' : 's'} ready for review`}
    actions={<Button size="sm" onClick={start}><Plus className="size-4" />New decision</Button>}
    toolbar={<><SearchInput value={query} onChange={setQuery} label="Search decisions" /><ChoiceInline label="Decision filter" value={filter} onChange={setFilter} options={['All', 'Due', 'Pending review', 'Reviewed', 'Archived']} /></>}>
    {error && !draft && !reviewing && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
    {records.length === 0 ? <EmptyPanel title={data.records.length ? 'No matching decisions' : 'No decisions yet'} description="Save what you expect now, then compare it with what happens." onReset={data.records.length ? () => { setQuery(''); setFilter('All'); } : undefined} action={!data.records.length ? <Button onClick={start}>New decision</Button> : undefined} />
      : <ListRows>{records.map((record) => <ListRow key={record.id} title={record.title} detail={record.values.choice} onOpen={() => setSelectedId(record.id)} meta={<><span>{record.date ? `Review ${record.date}` : 'No review date'}</span><StatusBadge status={decisionIsDue(record) ? 'Due' : record.status} completedStatuses={['Reviewed']} /></>} />)}</ListRows>}
    <RecordSheet record={selected} title={selected?.title || 'Decision'} subtitle="Prediction and outcome" onClose={() => setSelectedId(null)} actions={selected && <>
      <Button size="sm" variant="outline" onClick={() => { setError(''); setDraft(selected); setSelectedId(null); }}>Edit</Button>
      <Button size="sm" onClick={() => { setError(''); setReviewing(selected); setOutcome(''); setLessons(''); setSelectedId(null); }}>Review outcome</Button>
      <ConfirmDelete itemName={selected.title} itemLabel="decision" consequence="Its outcome history and cross-plugin links will also be removed." onDelete={() => remove(selected)} />
    </>}>
      {selected && <><FactGrid>
        <Fact label="Chosen option" value={selected.values.choice} wide /><Fact label="Alternatives" value={selected.values.alternatives} wide />
        <Fact label="Assumptions" value={selected.values.assumptions} wide /><Fact label="Expected outcome" value={selected.values.expectedOutcome} wide />
        <Fact label="Confidence" value={selected.values.confidence ? `${selected.values.confidence}%` : ''} /><Fact label="Review date" value={selected.date} />
        <Fact label="Actual outcome" value={selected.values.actualOutcome} wide /><Fact label="Lessons learned" value={selected.values.lessons} wide />
      </FactGrid><SourceNoteLink record={selected} workspace={workspace} /><JournalHistory record={selected} />
        <CrossPluginLinks uid={`${lifeStoreKey(DECISION_JOURNAL_PLUGIN_ID)}:records:${selected.id}`} />
      </>}
    </RecordSheet>
    {draft && <LearningEditor title={data.records.some((record) => record.id === draft.id) ? 'Edit decision' : 'New decision'} error={error} onClose={() => setDraft(null)} onSave={save}>
      <Field label="Title"><Input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
      <Choice label="Category" value={draft.category} options={['Personal', 'Career', 'Project', 'Learning']} onChange={(category) => setDraft({ ...draft, category })} />
      {(['choice', 'alternatives', 'assumptions', 'expectedOutcome'] as const).map((key, index) => <Field key={key} label={['Chosen option', 'Alternatives', 'Assumptions', 'Expected outcome'][index]}>
        <Textarea required={key === 'choice' || key === 'expectedOutcome'} value={draft.values[key] || ''} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, [key]: event.target.value } })} />
      </Field>)}
      <Field label="Confidence (%)"><Input type="number" min={0} max={100} value={draft.values.confidence || ''} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, confidence: event.target.value } })} /></Field>
      <Field label="Review date"><Input type="date" value={draft.date || ''} onChange={(event) => setDraft({ ...draft, date: event.target.value || undefined })} /></Field>
      <SourceNoteChoice draft={draft} setDraft={setDraft} workspace={workspace} />
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={draft.status === 'Archived'} onCheckedChange={(checked) => setDraft({ ...draft, status: checked ? 'Archived' : draft.values.reviewedOn ? 'Reviewed' : 'Pending review' })} />Archive this decision</label>
    </LearningEditor>}
    {reviewing && <LearningEditor title={`Review: ${reviewing.title}`} error={error} onClose={() => setReviewing(null)} onSave={finishReview} saveLabel="Complete review">
      <Fact label="Expected outcome" value={reviewing.values.expectedOutcome} />
      <Field label="Actual outcome"><Textarea required value={outcome} onChange={(event) => setOutcome(event.target.value)} /></Field>
      <Field label="Lessons learned"><Textarea value={lessons} onChange={(event) => setLessons(event.target.value)} /></Field>
    </LearningEditor>}
  </ViewShell>;
}

/** Each column is a prerequisite depth; shared prerequisites remain one node. */
function SkillMap({ skills, onOpen }: { skills: LifeRecord[]; onOpen: (id: string) => void }) {
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const depths = new Map<string, number>();
  const depth = (id: string, path = new Set<string>()): number => {
    if (path.has(id) || !byId.has(id)) return 0;
    if (depths.has(id)) return depths.get(id)!;
    const nextPath = new Set([...path, id]);
    const prerequisites = skillPrerequisites(byId.get(id)!);
    const value = prerequisites.length ? 1 + Math.max(...prerequisites.map((parent) => depth(parent, nextPath))) : 0;
    depths.set(id, value);
    return value;
  };
  const rows = new Map<number, number>();
  const nodes = skills.map((skill) => {
    const column = depth(skill.id);
    const row = rows.get(column) || 0;
    rows.set(column, row + 1);
    return { skill, x: column * 240 + 12, y: row * 96 + 12 };
  });
  const width = Math.max(240, ...nodes.map((node) => node.x + 228));
  const height = Math.max(108, ...nodes.map((node) => node.y + 96));
  return <div className="max-h-[420px] overflow-auto border-y border-border" aria-label="Skill prerequisite map">
    <div className="relative" style={{ width, height }}>
      <svg width={width} height={height} className="pointer-events-none absolute inset-0" aria-hidden="true">
        {nodes.flatMap((node) => skillPrerequisites(node.skill).map((id) => {
          const parent = nodes.find((item) => item.skill.id === id);
          if (!parent) return null;
          return <path key={`${id}-${node.skill.id}`} d={`M${parent.x + 204},${parent.y + 36} C${parent.x + 224},${parent.y + 36} ${node.x - 20},${node.y + 36} ${node.x},${node.y + 36}`} fill="none" className="stroke-border-strong" strokeWidth={2} />;
        }))}
      </svg>
      {nodes.map(({ skill, x, y }) => <button key={skill.id} type="button" aria-label={`Open skill ${skill.title}`} onClick={() => onOpen(skill.id)}
        className="absolute flex h-[72px] w-[204px] flex-col justify-center rounded-md border border-border bg-surface px-3 text-left hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ left: x, top: y }}>
        <span className="block w-full truncate text-sm font-medium">{skill.title}</span><span className="text-xs text-muted-foreground">{skillBlockers(skill, skills).length ? 'Prerequisites pending' : skill.status} · {skill.category}</span>
      </button>)}
    </div>
  </div>;
}

export function SkillTreeView(workspace: WorkspaceViewProps) {
  const { data, commit, error, setError } = useLearningCollection(SKILL_TREE_PLUGIN_ID);
  const removeRelations = useRemoveLifeOsRelations();
  const [query, setQuery] = useState('');
  const [layout, setLayout] = useState('Map');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LifeRecord | null>(null);
  const [practicing, setPracticing] = useState<LifeRecord | null>(null);
  const [activity, setActivity] = useState('');
  const [minutes, setMinutes] = useState('30');
  const selected = data.records.find((record) => record.id === selectedId) ?? null;
  const records = data.records.filter((record) => `${record.title} ${record.category} ${record.values.practicePlan || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const start = () => { setError(''); setDraft(newLearningRecord('Planned', 'Education')); };
  const save = () => {
    if (!draft) return;
    if (commit((current) => {
      validateSkill(draft, current.records);
      return { ...current, records: current.records.some((record) => record.id === draft.id)
        ? current.records.map((record) => record.id === draft.id ? { ...record, ...draft, title: draft.title.trim() } : record)
        : [{ ...draft, title: draft.title.trim() }, ...current.records] };
    })) setDraft(null);
  };
  const remove = (skill: LifeRecord) => {
    if (commit((current) => {
      if (current.records.some((record) => skillPrerequisites(record).includes(skill.id))) throw new Error('Remove this skill from other skills’ prerequisites before deleting it.');
      return { ...current, records: current.records.filter((record) => record.id !== skill.id) };
    })) {
      removeRelations(`${lifeStoreKey(SKILL_TREE_PLUGIN_ID)}:records:${skill.id}`);
      setSelectedId(null);
    }
  };
  const practice = () => {
    if (!practicing) return;
    if (commit((current) => {
      const skill = current.records.find((record) => record.id === practicing.id);
      if (!skill) throw new Error('This skill was removed.');
      const updated = logSkillPractice(skill, activity, Number(minutes));
      return { ...current, records: current.records.map((record) => record.id === skill.id ? updated : record) };
    })) setPracticing(null);
  };
  return <ViewShell title="Skill Tree" icon={GitBranch} subtitle={`${data.records.filter((skill) => skill.status === 'Mastered').length} of ${data.records.length} skills mastered`}
    actions={<Button size="sm" onClick={start}><Plus className="size-4" />New skill</Button>}
    toolbar={<><SearchInput value={query} onChange={setQuery} label="Search skills" /><ChoiceInline label="Skill layout" value={layout} onChange={setLayout} options={['Map', 'List']} /></>}>
    {error && !draft && !practicing && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
    {records.length === 0 ? <EmptyPanel title={data.records.length ? 'No matching skills' : 'Start your skill tree'} description="Add a skill, define mastery, and connect its prerequisites." onReset={data.records.length ? () => setQuery('') : undefined} action={!data.records.length ? <Button onClick={start}>New skill</Button> : undefined} />
      : layout === 'Map' && !query ? <SkillMap skills={data.records} onOpen={setSelectedId} />
        : <ListRows>{records.map((skill) => <ListRow key={skill.id} title={skill.title} detail={`${skill.category} · ${skill.values.practiceMinutes || 0} minutes practiced · ${skillBlockers(skill, data.records).length} prerequisites pending`} onOpen={() => setSelectedId(skill.id)} meta={<StatusBadge status={skill.status} completedStatuses={['Mastered']} />} />)}</ListRows>}
    <RecordSheet record={selected} title={selected?.title || 'Skill'} subtitle="Prerequisites, practice, and evidence" onClose={() => setSelectedId(null)} actions={selected && <>
      <Button size="sm" variant="outline" onClick={() => { setError(''); setDraft(selected); setSelectedId(null); }}>Edit</Button>
      <Button size="sm" onClick={() => { setError(''); setPracticing(selected); setActivity(''); setMinutes('30'); setSelectedId(null); }}>Log practice</Button>
      <ConfirmDelete itemName={selected.title} itemLabel="skill" consequence="Its practice history and cross-plugin links will also be removed. Skills used as prerequisites must be unlinked first." onDelete={() => remove(selected)} />
    </>}>
      {selected && <>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <FactGrid><Fact label="Status" value={selected.status} /><Fact label="Target date" value={selected.date} />
          <Fact label="Mastery criteria" value={selected.values.targetEvidence} wide /><Fact label="Practice plan" value={selected.values.practicePlan} wide />
          <Fact label="Evidence of mastery" value={selected.values.evidence} wide /><Fact label="Practice time" value={`${selected.values.practiceMinutes || 0} minutes`} />
        </FactGrid>
        <section className="mt-3"><h3 className="text-sm font-medium">Prerequisites</h3>{skillPrerequisites(selected).length ? <ListRows>{skillPrerequisites(selected).map((id) => {
          const prerequisite = data.records.find((record) => record.id === id);
          return <ListRow key={id} title={prerequisite?.title || 'Missing skill'} detail={prerequisite?.status || 'Edit this skill to remove the missing prerequisite.'} onOpen={prerequisite ? () => setSelectedId(id) : undefined} />;
        })}</ListRows> : <p className="mt-1 text-sm text-muted-foreground">No prerequisites.</p>}</section>
        <SourceNoteLink record={selected} workspace={workspace} /><JournalHistory record={selected} />
        <CrossPluginLinks uid={`${lifeStoreKey(SKILL_TREE_PLUGIN_ID)}:records:${selected.id}`} />
      </>}
    </RecordSheet>
    {draft && <LearningEditor title={data.records.some((record) => record.id === draft.id) ? 'Edit skill' : 'New skill'} error={error} onClose={() => setDraft(null)} onSave={save}>
      <Field label="Skill name"><Input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
      <Choice label="Domain" value={draft.category} options={['Education', 'Career', 'Hobby']} onChange={(category) => setDraft({ ...draft, category })} />
      <Choice label="Status" value={draft.status} options={['Planned', 'Practicing', 'Mastered', 'Paused']} onChange={(status) => setDraft({ ...draft, status })} />
      {(['targetEvidence', 'practicePlan', 'evidence'] as const).map((key, index) => <Field key={key} label={['Mastery criteria', 'Practice plan', 'Evidence of mastery'][index]}><Textarea value={draft.values[key] || ''} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, [key]: event.target.value } })} /></Field>)}
      <Field label="Target date"><Input type="date" value={draft.date || ''} onChange={(event) => setDraft({ ...draft, date: event.target.value || undefined })} /></Field>
      <SourceNoteChoice draft={draft} setDraft={setDraft} workspace={workspace} />
      <fieldset className="space-y-2 border-t border-border pt-3"><legend className="text-sm font-medium">Prerequisites</legend>
        {data.records.filter((record) => record.id !== draft.id).map((record) => <label key={record.id} className="flex items-center gap-2 text-sm"><Checkbox checked={skillPrerequisites(draft).includes(record.id)} onCheckedChange={(checked) => {
          const ids = skillPrerequisites(draft).filter((id) => id !== record.id);
          setDraft({ ...draft, values: { ...draft.values, prerequisites: JSON.stringify(checked ? [...ids, record.id] : ids) } });
        }} />{record.title} <span className="text-xs text-muted-foreground">{record.status}</span></label>)}
        {!data.records.some((record) => record.id !== draft.id) && <p className="text-sm text-muted-foreground">Add another skill to choose it as a prerequisite.</p>}
        {skillPrerequisites(draft).filter((id) => !data.records.some((record) => record.id === id)).map((id) => <Button key={id} type="button" variant="outline" size="sm" onClick={() => setDraft({ ...draft, values: { ...draft.values, prerequisites: JSON.stringify(skillPrerequisites(draft).filter((value) => value !== id)) } })}>Remove missing prerequisite</Button>)}
      </fieldset>
    </LearningEditor>}
    {practicing && <LearningEditor title={`Practice: ${practicing.title}`} error={error} onClose={() => setPracticing(null)} onSave={practice} saveLabel="Save practice">
      <Field label="Activity and observations"><Textarea required value={activity} onChange={(event) => setActivity(event.target.value)} /></Field>
      <Field label="Minutes"><Input required type="number" min={1} max={1440} step={1} value={minutes} onChange={(event) => setMinutes(event.target.value)} /></Field>
    </LearningEditor>}
  </ViewShell>;
}
