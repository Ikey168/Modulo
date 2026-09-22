import { useState } from 'react';
import { ClipboardCheck, Plus } from 'lucide-react';
import { Button, Checkbox, Input, Textarea } from '@/ui';
import type { WorkspaceViewProps } from './plugins/types';
import { EmptyPanel, Field, Panel, SearchInput, ViewShell } from './viewkit';
import { useServerWorkspaceStore } from './useWorkspaceStore';
import { SOPS_STORE_KEY, emptySops, finishSopRun, parseSops, startSopRun, type SopData, type SopProcedure, type SopRun } from './sops';

export function PersonalSopsView({ data: workspace, onOpenNote }: WorkspaceViewProps) {
  const [data, persist] = useServerWorkspaceStore('personal-sops', 'data', 'modulo.workspace.personal-sops', emptySops(), parseSops, SOPS_STORE_KEY, 'Personal SOPs');
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editor, setEditor] = useState<SopProcedure | 'new' | null>(null);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [error, setError] = useState('');
  const save = (update: (current: SopData) => SopData): boolean => {
    try {
      let rejected: unknown;
      const accepted = persist((current) => {
        try { return update(current); } catch (cause) { rejected = cause; throw cause; }
      });
      if (rejected) throw rejected;
      if (!accepted) throw new Error('Changes could not be saved yet. Wait for the workspace to sync and retry.');
      setError('');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Changes could not be saved.');
      return false;
    }
  };
  const procedures = data.procedures.filter((p) => p.archived === showArchived && `${p.title} ${p.description}`.toLowerCase().includes(query.toLowerCase()));
  const run = data.runs.find((r) => r.id === selectedRun);
  const updateRun = (id: string, update: (current: SopRun) => SopRun) => save((current) => {
    if (!current.runs.some((r) => r.id === id)) throw new Error('This run is no longer available.');
    return { ...current, runs: current.runs.map((r) => r.id === id ? update(r) : r) };
  });
  const linkedNotes = (ids: number[]) => ids.length > 0 && <div className="flex flex-wrap gap-2">{ids.map((id) => {
    const note = workspace.notes.find((n) => n.id === id);
    return note ? <Button key={id} size="sm" variant="link" onClick={() => onOpenNote(id)}>{note.title}</Button> : <span key={id} className="text-sm text-muted-foreground">Linked note unavailable (#{id})</span>;
  })}</div>;

  return <ViewShell title="Personal SOPs" icon={ClipboardCheck}
    actions={<Button size="sm" disabled={!!editor || !!data.storageError} onClick={() => setEditor('new')}><Plus className="size-4" />New procedure</Button>}
    toolbar={<><SearchInput className="basis-full sm:basis-auto" value={query} onChange={setQuery} placeholder="Search procedures" /><Button size="sm" variant="outline" aria-pressed={showArchived} onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Show active procedures' : 'Show archived procedures'}</Button></>}>
    <div className="space-y-4">
      {(error || data.storageError) && <p role="alert" className="text-sm text-destructive">{data.storageError || error}</p>}
      {editor && <ProcedureEditor key={editor === 'new' ? 'new' : editor.id} procedure={editor === 'new' ? undefined : editor} notes={workspace.notes} onCancel={() => setEditor(null)} onSave={(procedure) => {
        const saved = save((current) => {
          if (editor !== 'new' && current.procedures.find((p) => p.id === editor.id)?.updatedAt !== editor.updatedAt) throw new Error('This procedure changed elsewhere. Cancel and reopen it before saving.');
          return { ...current, procedures: editor === 'new' ? [...current.procedures, procedure] : current.procedures.map((p) => p.id === procedure.id ? procedure : p) };
        });
        if (saved) setEditor(null);
      }} />}
      <Panel title={showArchived ? 'Archived procedures' : 'Procedures'} bodyClassName="p-0">
        {procedures.length === 0 ? <EmptyPanel title={query ? 'No matching procedures' : showArchived ? 'No archived procedures' : 'No procedures yet'} description={!query && !showArchived ? 'Create a checklist for something you do regularly.' : undefined} onReset={query ? () => setQuery('') : undefined} action={!query && !showArchived ? <Button size="sm" disabled={!!editor || !!data.storageError} onClick={() => setEditor('new')}>New procedure</Button> : undefined} /> : <ul className="divide-y divide-border">{procedures.map((procedure) => <li key={procedure.id} className="space-y-2 p-3">
          <div className="flex flex-wrap items-start gap-2"><div className="min-w-0 basis-full sm:flex-1 sm:basis-0"><h4 className="break-words text-sm font-medium">{procedure.title}</h4><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{procedure.description}</p></div>
            {!procedure.archived && <Button size="sm" onClick={() => {
              let started: SopRun | undefined;
              if (save((current) => {
                const latest = current.procedures.find((p) => p.id === procedure.id);
                if (!latest) throw new Error('This procedure is no longer available.');
                started = startSopRun(latest);
                return { ...current, runs: [started, ...current.runs] };
              }) && started) setSelectedRun(started.id);
            }}>Start run</Button>}
            <Button size="sm" variant="outline" disabled={!!editor} onClick={() => setEditor(procedure)}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={() => save((current) => ({ ...current, procedures: current.procedures.map((p) => p.id === procedure.id ? { ...p, archived: !p.archived, updatedAt: new Date().toISOString() } : p) }))}>{procedure.archived ? 'Restore' : 'Archive'}</Button>
          </div>
          <details><summary className="cursor-pointer text-sm text-muted-foreground">{procedure.steps.length} steps</summary><ol className="list-decimal space-y-1 py-2 pl-6 text-sm">{procedure.steps.map((step, i) => <li key={i} className="break-words">{step}</li>)}</ol></details>
          {linkedNotes(procedure.noteIds)}
        </li>)}</ul>}
      </Panel>
      {run && <Panel title={run.title} actions={<Button size="sm" variant="ghost" onClick={() => setSelectedRun(null)}>Close run</Button>}>
        <p className="mb-3 text-sm text-muted-foreground">{run.status} · Started {new Date(run.createdAt).toLocaleString()}{run.finishedAt ? ` · Finished ${new Date(run.finishedAt).toLocaleString()}` : ''}</p>
        {run.description && <p className="mb-3 whitespace-pre-wrap break-words text-sm">{run.description}</p>}
        <ol className="space-y-3">{run.steps.map((step, index) => <li key={index}><label className="flex items-start gap-2 text-sm"><Checkbox checked={step.done} disabled={run.status !== 'Active'} onCheckedChange={(checked) => updateRun(run.id, (current) => current.status !== 'Active' ? current : { ...current, steps: current.steps.map((s, i) => i === index ? { ...s, done: checked === true } : s) })} /><span className="min-w-0 break-words">{index + 1}. {step.title}</span></label></li>)}</ol>
        <p className="my-3 text-sm text-muted-foreground">{run.steps.filter((s) => s.done).length} of {run.steps.length} complete</p>
        {linkedNotes(run.noteIds)}
        <RunNotes key={run.id} run={run} notes={workspace.notes} onFinish={(status) => updateRun(run.id, (current) => finishSopRun(current, status))} onSave={(notes, ids, previous) => updateRun(run.id, (current) => {
          if (current.status !== 'Active') throw new Error('This run has already finished.');
          if (current.notes !== previous.notes || JSON.stringify(current.noteIds) !== JSON.stringify(previous.noteIds)) throw new Error('Run notes changed elsewhere. Cancel and reopen the editor.');
          return { ...current, notes, noteIds: ids };
        })} />

      </Panel>}
      <Panel title="Run history" bodyClassName="p-0">
        {!data.runs.length ? <EmptyPanel title="No runs yet" description="Start a procedure to keep a separate checklist and record of each run." /> : <ul className="divide-y divide-border">{data.runs.map((r) => <li key={r.id}><button type="button" aria-pressed={selectedRun === r.id} className="flex w-full flex-wrap items-center gap-2 p-3 text-left text-sm hover:bg-muted" onClick={() => setSelectedRun(r.id)}><span className="min-w-0 basis-full break-words font-medium sm:flex-1 sm:basis-0">{r.title}</span><span>{r.status} · {r.steps.filter((s) => s.done).length}/{r.steps.length}</span><span className="text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span></button></li>)}</ul>}
      </Panel>
    </div>
  </ViewShell>;
}

type Notes = WorkspaceViewProps['data']['notes'];
function NotePicker({ notes, value, onChange }: { notes: Notes; value: number[]; onChange: (ids: number[]) => void }) {
  return <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Linked notes</legend><div className="max-h-40 space-y-2 overflow-y-auto">{!notes.length && !value.length && <p className="text-sm text-muted-foreground">Create a workspace note to link instructions or evidence.</p>}{notes.map((note) => <label key={note.id} className="flex items-center gap-2 text-sm"><Checkbox checked={value.includes(note.id)} onCheckedChange={(checked) => onChange(checked === true ? [...value, note.id] : value.filter((id) => id !== note.id))} /><span className="truncate">{note.title}</span></label>)}{value.filter((id) => !notes.some((note) => note.id === id)).map((id) => <label key={id} className="flex items-center gap-2 text-sm"><Checkbox checked onCheckedChange={() => onChange(value.filter((n) => n !== id))} />Unavailable note (#{id})</label>)}</div></fieldset>;
}
function ProcedureEditor({ procedure, notes, onCancel, onSave }: { procedure?: SopProcedure; notes: Notes; onCancel: () => void; onSave: (value: SopProcedure) => void }) {
  const [title, setTitle] = useState(procedure?.title ?? '');
  const [description, setDescription] = useState(procedure?.description ?? '');
  const [steps, setSteps] = useState(procedure?.steps.join('\n') ?? '');
  const [ids, setIds] = useState(procedure?.noteIds ?? []);
  const parsedSteps = steps.split('\n').map((s) => s.trim()).filter(Boolean);
  return <Panel title={procedure ? 'Edit procedure' : 'New procedure'}><form className="space-y-3" onSubmit={(e) => {
    e.preventDefault();
    if (!title.trim() || !parsedSteps.length) return;
    onSave({ id: procedure?.id ?? crypto.randomUUID(), title: title.trim(), description: description.trim(), steps: parsedSteps, noteIds: ids, archived: procedure?.archived ?? false, updatedAt: new Date().toISOString() });
  }} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.requestSubmit(); } }}>
    <Field label="Title"><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
    <Field label="Instructions"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
    <Field label="Steps" hint="One step per line. Runs keep the steps as they were when started."><Textarea required rows={6} value={steps} onChange={(e) => setSteps(e.target.value)} /></Field>
    <NotePicker notes={notes} value={ids} onChange={setIds} />
    <div className="flex gap-2"><Button type="submit" size="sm" disabled={!title.trim() || !parsedSteps.length}>Save procedure</Button><Button type="button" size="sm" variant="outline" onClick={onCancel}>Cancel</Button></div>
  </form></Panel>;
}
function RunNotes({ run, notes, onSave, onFinish }: { run: SopRun; notes: Notes; onFinish: (status: 'Completed' | 'Cancelled') => void; onSave: (text: string, ids: number[], previous: SopRun) => boolean }) {
  const [draft, setDraft] = useState<{ notes: string; noteIds: number[]; previous: SopRun } | null>(null);
  if (!draft) return <div className="mt-3 space-y-2"><p className="whitespace-pre-wrap break-words text-sm">{run.notes || 'No run notes.'}</p>{run.status === 'Active' && <Button size="sm" variant="outline" onClick={() => setDraft({ notes: run.notes, noteIds: [...run.noteIds], previous: run })}>Edit run notes & links</Button>}        {run.status === 'Active' && <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" disabled={!run.steps.every((s) => s.done)} onClick={() => onFinish('Completed')}>Complete run</Button><Button size="sm" variant="outline" onClick={() => onFinish('Cancelled')}>Cancel run</Button></div>}</div>;
  return <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); if (onSave(draft.notes, draft.noteIds, draft.previous)) setDraft(null); }} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.requestSubmit(); } }}>
    <Field label="Run notes"><Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
    <NotePicker notes={notes} value={draft.noteIds} onChange={(noteIds) => setDraft({ ...draft, noteIds })} />
    <div className="flex gap-2"><Button type="submit" size="sm">Save run notes</Button><Button type="button" size="sm" variant="outline" onClick={() => setDraft(null)}>Cancel editing</Button></div>
  </form>;
}
