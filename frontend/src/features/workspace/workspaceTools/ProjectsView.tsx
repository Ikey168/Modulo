import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { WorkspaceViewProps } from '../plugins/types';
import { newLearningRecord, validateDecision, decisionIsDue } from '../learningTools';
import { dayKey } from '../noteDates';
import { bodyOf, field, now, replaceNote, uid, useAction } from './shared';
import { ToolPage } from './ToolPage';
import { parseSteps } from './runbooks';
import { attachProjectNote, detachProjectNote, newProject, PROJECT_STATUSES, projectTasks, toggleProjectTask, type ProjectWorkspace } from './projects';
import { useProjectData } from './useProjectData';

const sections = ['Overview', 'Notes', 'Tasks', 'Decisions', 'Runbooks', 'Evidence'] as const;
export default function ProjectsView({ data, onOpenNote }: WorkspaceViewProps) {
  const stores = useProjectData(); const action = useAction(); const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(''); const [showArchived, setShowArchived] = useState(false);
  const [draft, setDraft] = useState<ProjectWorkspace>(); const [noteId, setNoteId] = useState('');
  const [noteTitle, setNoteTitle] = useState(''); const [noteBody, setNoteBody] = useState('');
  const [taskTitle, setTaskTitle] = useState(''); const [taskDue, setTaskDue] = useState(''); const [taskNote, setTaskNote] = useState('');
  const [decisionId, setDecisionId] = useState(''); const [decisionTitle, setDecisionTitle] = useState(''); const [choice, setChoice] = useState(''); const [expected, setExpected] = useState(''); const [reviewDate, setReviewDate] = useState('');
  const project = stores.projects.value.projects.find(item => item.id === params.get('project'));
  const section = sections.find(section => section === params.get('section')) ?? 'Overview';
  const editable = stores.ready && !action.busy && project?.status !== 'Archived';
  const projects = stores.projects.value.projects.filter(item => (showArchived || item.status !== 'Archived') && `${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase()));
  const notes = data.notes.filter(note => project?.noteIds.includes(note.id));
  const tasks = projectTasks(notes.filter(note => !project?.procedureIds.includes(note.id)));
  const decisions = stores.decisions.value.records.filter(decision => project?.decisionIds.includes(decision.id));
  const runs = stores.runbooks.value.runs.filter(run => project?.procedureIds.includes(run.noteId) && (!run.projectId || run.projectId === project.id));
  const today = dayKey(new Date());
  const update = async (change: (project: ProjectWorkspace) => ProjectWorkspace) => {
    if (!project) throw new Error('Choose a project first.');
    await stores.projects.save(previous => {
      const current = previous.projects.find(item => item.id === project.id);
      if (!current) throw new Error('This project was removed.');
      return { projects: previous.projects.map(item => item.id === project.id ? { ...change(current), updatedAt: now() } : item) };
    });
  };
  const select = (id: string) => { setParams({ project: id }); setDraft(undefined); setNoteId(''); setTaskNote(''); setDecisionId(''); setNoteTitle(''); setNoteBody(''); setTaskTitle(''); setTaskDue(''); setDecisionTitle(''); setChoice(''); setExpected(''); setReviewDate(''); };
  const role = section === 'Evidence' ? 'evidence' : section === 'Runbooks' ? 'procedure' : 'note';
  const listedIds = project ? section === 'Evidence' ? project.evidenceIds : section === 'Runbooks' ? project.procedureIds : project.noteIds : [];
  const attach = () => action.run(async () => {
    const note = data.notes.find(note => note.id === Number(noteId)); if (!note) throw new Error('Choose an available note.');
    if (role === 'procedure') parseSteps(bodyOf(note));
    await update(current => attachProjectNote(current, note.id, role)); setNoteId('');
  });
  return <ToolPage title="Project Workspaces" notice={<>{stores.projects.notice}{stores.decisions.notice}{stores.runbooks.notice}</>}>
    {action.alert}
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1">Project<select aria-label="Project" className={`${field} block w-full`} disabled={action.busy} value={project?.id ?? ''} onChange={event => select(event.target.value)}><option value="">Choose a project</option>{projects.map(item => <option key={item.id} value={item.id}>{item.title} · {item.status}</option>)}{project && !projects.some(item => item.id === project.id) && <option value={project.id}>{project.title} · {project.status}</option>}</select></label>
      <button className={field} disabled={!stores.ready || action.busy} onClick={() => setDraft(newProject(''))}>New project</button>
    </div>
    <div className="flex flex-wrap items-center gap-3"><label>Find projects<input className={`${field} block`} value={query} onChange={event => setQuery(event.target.value)} /></label><label className="flex gap-2"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} />Include archived projects</label></div>
    {stores.projects.ready && !project && !draft && <p>{params.get('project') ? 'This project is unavailable in the current account.' : 'Create a project or choose one to organize its work.'}</p>}
    {draft && <form className="space-y-3 border-y border-border py-4" onSubmit={event => { event.preventDefault(); void action.run(async () => {
      await stores.projects.save(previous => {
        const old = previous.projects.find(item => item.id === draft.id);
        if (old && old.updatedAt !== draft.updatedAt) throw new Error('The project changed while you were editing. Reopen its details to review the latest version.');
        return { projects: [...previous.projects.filter(item => item.id !== draft.id), { ...draft, title: draft.title.trim(), updatedAt: now() }] };
      }); select(draft.id);
    }); }}><fieldset disabled={!stores.ready || action.busy} className="space-y-3"><legend className="font-medium">{stores.projects.value.projects.some(item => item.id === draft.id) ? 'Edit project' : 'New project'}</legend>
      <label className="block">Project name<input className={`${field} block w-full`} required maxLength={180} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
      <label className="block">Purpose and outcome<textarea className={`${field} block w-full`} maxLength={20000} rows={3} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
      <div className="flex flex-wrap gap-3"><label>Status<select aria-label="Project status" className={`${field} block`} value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as ProjectWorkspace['status'] })}>{PROJECT_STATUSES.map(status => <option key={status}>{status}</option>)}</select></label><label>Deadline<input className={`${field} block`} type="date" value={draft.deadline} onChange={event => setDraft({ ...draft, deadline: event.target.value })} /></label></div>
      <button className={field}>Save project</button><button className={`${field} ml-2`} type="button" onClick={() => setDraft(undefined)}>Cancel</button>
    </fieldset></form>}
    {project && !draft && <>
      <header className="space-y-2"><h2 className="text-lg font-semibold break-words">{project.title}</h2><p className="whitespace-pre-wrap break-words text-sm">{project.description || 'No project description yet.'}</p><p className="text-sm">{project.status}{project.deadline && ` · Due ${project.deadline}`}</p>
        <div className="flex flex-wrap gap-3"><button className={field} disabled={!stores.ready || action.busy} onClick={() => setDraft(project)}>Edit project</button>
          <Link className={`${field} inline-block`} to={`/app/workspace-capsules?project=${encodeURIComponent(project.id)}`}>Export project capsule</Link>
          <button className={field} disabled={!stores.ready || action.busy} onClick={() => { if (window.confirm('Delete this project organization? Its notes, decisions, runbooks and attachments are retained.')) void action.run(async () => { await stores.projects.save(previous => ({ projects: previous.projects.filter(item => item.id !== project.id) })); setParams({}); }); }}>Delete project</button>
        </div>
      </header>
      <nav aria-label="Project sections" className="flex flex-wrap gap-x-4 gap-y-2 border-b border-border">{sections.map(tab => <button key={tab} className={`border-b-2 py-2 text-sm ${section === tab ? 'border-primary font-medium' : 'border-transparent'}`} aria-current={section === tab ? 'page' : undefined} disabled={action.busy} onClick={() => { setParams({ project: project.id, section: tab }); setNoteId(''); }}>{tab}</button>)}</nav>
      {project.status === 'Archived' && <p role="status">This project is archived. Change its status in Edit project to organize it again.</p>}
      {section === 'Overview' && <section className="space-y-4" aria-label="Project overview">
        <p>{notes.length} notes · {tasks.filter(task => task.done).length}/{tasks.length} tasks complete · {decisions.length} decisions · {runs.length} runbook receipts</p>
        <div><h3 className="font-medium">Needs attention</h3><ul className="mt-2 space-y-2">{tasks.filter(task => !task.done && task.due && task.due < today).map(task => <li key={`${task.note.id}:${task.line}`}><button className="underline" onClick={() => onOpenNote(task.note.id)}>Overdue: {task.title}</button></li>)}{decisions.filter(decision => decisionIsDue(decision)).map(decision => <li key={decision.id}><Link className="underline" to={`/app/decision-journal?decision=${encodeURIComponent(decision.id)}`}>Review decision: {decision.title}</Link></li>)}{runs.filter(run => run.steps.some(step => ['FAILED', 'DEAD_LETTER', 'CANCELLED'].includes(step.state))).map(run => <li key={run.id}><Link className="underline" to={`/app/executable-runbooks?run=${encodeURIComponent(run.id)}`}>Inspect run: {run.title}</Link></li>)}</ul></div>
        <div><h3 className="font-medium">Recently changed notes</h3><ul className="mt-2 space-y-2">{[...notes].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')).slice(0, 8).map(note => <li key={note.id}><button className="underline" onClick={() => onOpenNote(note.id)}>{note.title}</button></li>)}</ul></div>
        {project.noteIds.filter(id => !data.notes.some(note => note.id === id)).map(id => <p key={id}>Unavailable note #{id}. Detach it in Notes or restore access.</p>)}
      </section>}
      {['Notes', 'Evidence', 'Runbooks'].includes(section) && <section className="space-y-4" aria-label={`Project ${section.toLowerCase()}`}>
        <fieldset disabled={!editable || data.loading} className="flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1">Existing {role === 'procedure' ? 'procedure' : 'note'}<select aria-label="Existing project note" className={`${field} block w-full`} value={noteId} onChange={event => setNoteId(event.target.value)}><option value="">Choose note</option>{data.notes.filter(note => !listedIds.includes(note.id)).map(note => <option key={note.id} value={note.id}>{note.title}</option>)}</select></label><button className={field} disabled={!noteId} onClick={() => void attach()}>Attach {role}</button></fieldset>
        <ul className="divide-y divide-border">{listedIds.map(id => { const note = data.notes.find(note => note.id === id); return <li key={id} className="flex flex-wrap items-center gap-3 py-3"><button className="min-w-0 break-words underline" disabled={!note} onClick={() => onOpenNote(id)}>{note?.title ?? `Unavailable note #${id}`}</button>
          {section === 'Evidence' && <span className="text-sm text-muted-foreground">Open note to review evidence and attachments</span>}
          {section === 'Runbooks' && <button className={field} disabled={!editable || !note} onClick={() => void action.run(async () => { if (!note) return; const run = { id: uid(), projectId: project.id, noteId: id, title: note.title, source: bodyOf(note), startedAt: now(), steps: parseSteps(bodyOf(note)) }; await stores.runbooks.save(previous => ({ runs: [run, ...previous.runs] })); navigate(`/app/executable-runbooks?run=${run.id}`); })}>Start run</button>}
          <button className="ml-auto text-sm underline" disabled={!editable} onClick={() => void action.run(() => update(current => section === 'Notes' ? detachProjectNote(current, id) : { ...current, [section === 'Evidence' ? 'evidenceIds' : 'procedureIds']: (section === 'Evidence' ? current.evidenceIds : current.procedureIds).filter(noteId => noteId !== id) }))}>Detach {role}</button>
        </li>; })}</ul>
        {!listedIds.length && <p>No {section.toLowerCase()} attached yet.</p>}
        <details><summary>Create {role === 'procedure' ? 'a procedure note' : 'a project note'}</summary><form className="mt-3 space-y-3" onSubmit={event => { event.preventDefault(); void action.run(async () => {
          if (role === 'procedure') parseSteps(noteBody);
          const note = await data.createNote(noteTitle.trim(), noteBody); if (!note) throw new Error('Could not create note.');
          try { await update(current => attachProjectNote(current, note.id, role)); } catch { throw new Error(`Note #${note.id} was created. Attach it using Existing project note after resolving synchronization.`); }
          setNoteTitle(''); setNoteBody('');
        }); }}><fieldset disabled={!editable} className="space-y-3"><label className="block">Note title<input className={`${field} block w-full`} required maxLength={180} value={noteTitle} onChange={event => setNoteTitle(event.target.value)} /></label><label className="block">Note content<textarea className={`${field} block w-full`} rows={5} maxLength={200000} value={noteBody} onChange={event => setNoteBody(event.target.value)} /></label><button className={field} disabled={!noteTitle.trim()}>Create and attach note</button></fieldset></form></details>
        {section === 'Runbooks' && <div className="space-y-2"><h3 className="font-medium">Run history</h3>{runs.map(run => <p key={run.id}><Link className="underline" to={`/app/executable-runbooks?run=${encodeURIComponent(run.id)}`}>{run.title} · {run.steps.filter(step => step.state === 'SUCCEEDED').length}/{run.steps.length} steps · {run.imported ? 'Imported receipt' : new Date(run.startedAt).toLocaleString()}</Link></p>)}</div>}
      </section>}
      {section === 'Tasks' && <section className="space-y-4" aria-label="Project tasks"><p className="text-sm">Tasks are checklists in project notes. Procedure checklists stay in Runbooks.</p>
        <ul className="divide-y divide-border">{tasks.map(task => <li key={`${task.note.id}:${task.line}`} className="flex items-start gap-3 py-3"><input type="checkbox" aria-label={`Complete ${task.title}`} className="mt-1" checked={task.done} disabled={!editable} onChange={() => void action.run(async () => { await replaceNote(task.note, { title: task.note.title, content: toggleProjectTask(task, bodyOf(task.note)) }); await data.refresh(); })} /><div className="min-w-0"><p className="break-words">{task.title}</p><button className="text-sm underline" onClick={() => onOpenNote(task.note.id)}>{task.note.title}</button></div></li>)}</ul>
        {!tasks.length && <p>No project tasks yet.</p>}
        <form onSubmit={event => { event.preventDefault(); void action.run(async () => { const note = notes.find(note => note.id === Number(taskNote)); if (!note || project.procedureIds.includes(note.id)) throw new Error('Choose a project note for this task.'); const markdown = `${bodyOf(note).trimEnd()}\n- [ ] ${taskTitle.trim().replace(/[\r\n]/g, ' ')}${taskDue ? ` due:: ${taskDue}` : ''}\n`; await replaceNote(note, { title: note.title, content: markdown }); await data.refresh(); setTaskTitle(''); }); }}><fieldset disabled={!editable} className="space-y-3"><label className="block">Task<input className={`${field} block w-full`} required maxLength={1000} value={taskTitle} onChange={event => setTaskTitle(event.target.value)} /></label><div className="flex flex-wrap gap-3"><label>Task note<select aria-label="Task note" className={`${field} block max-w-full`} value={taskNote} onChange={event => setTaskNote(event.target.value)}><option value="">Choose project note</option>{notes.filter(note => !project.procedureIds.includes(note.id)).map(note => <option key={note.id} value={note.id}>{note.title}</option>)}</select></label><label>Task due date<input className={`${field} block`} type="date" value={taskDue} onChange={event => setTaskDue(event.target.value)} /></label></div><button className={field} disabled={!taskTitle.trim() || !taskNote}>Add task</button></fieldset></form>
      </section>}
      {section === 'Decisions' && <section className="space-y-4" aria-label="Project decisions"><fieldset disabled={!editable} className="flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1">Existing decision<select aria-label="Existing decision" className={`${field} block w-full`} value={decisionId} onChange={event => setDecisionId(event.target.value)}><option value="">Choose decision</option>{stores.decisions.value.records.filter(decision => !project.decisionIds.includes(decision.id)).map(decision => <option key={decision.id} value={decision.id}>{decision.title}</option>)}</select></label><button className={field} disabled={!decisionId} onClick={() => void action.run(async () => { await update(current => ({ ...current, decisionIds: [...new Set([...current.decisionIds, decisionId])] })); setDecisionId(''); })}>Attach decision</button></fieldset>
        <ul className="divide-y divide-border">{project.decisionIds.map(id => { const decision = decisions.find(decision => decision.id === id); return <li key={id} className="flex flex-wrap gap-3 py-3">{decision ? <Link className="underline" to={`/app/decision-journal?decision=${encodeURIComponent(id)}`}>{decision.title} · {decision.status}</Link> : <span>Unavailable decision</span>}<button className="ml-auto text-sm underline" disabled={!editable} onClick={() => void action.run(() => update(current => ({ ...current, decisionIds: current.decisionIds.filter(item => item !== id) })))}>Detach decision</button></li>; })}</ul>
        <details><summary>Create a project decision</summary><form className="mt-3 space-y-3" onSubmit={event => { event.preventDefault(); void action.run(async () => { const decision = { ...newLearningRecord('Pending review', 'Project'), title: decisionTitle.trim(), date: reviewDate || undefined, values: { choice, expectedOutcome: expected } }; validateDecision(decision); await stores.decisions.save(previous => ({ ...previous, records: [decision, ...previous.records] })); await update(current => ({ ...current, decisionIds: [...current.decisionIds, decision.id] })); setDecisionTitle(''); setChoice(''); setExpected(''); navigate(`/app/decision-journal?decision=${encodeURIComponent(decision.id)}`); }); }}><fieldset disabled={!editable} className="space-y-3"><label className="block">Decision title<input className={`${field} block w-full`} required value={decisionTitle} onChange={event => setDecisionTitle(event.target.value)} /></label><label className="block">Chosen option<textarea className={`${field} block w-full`} required value={choice} onChange={event => setChoice(event.target.value)} /></label><label className="block">Expected outcome<textarea className={`${field} block w-full`} required value={expected} onChange={event => setExpected(event.target.value)} /></label><label className="block">Review date<input className={`${field} block`} type="date" value={reviewDate} onChange={event => setReviewDate(event.target.value)} /></label><button className={field}>Save project decision</button></fieldset></form></details>
      </section>}
    </>}
  </ToolPage>;
}
