import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { NotePanelProps } from '../plugins/types';
import { attachProjectNote, detachProjectNote, emptyProjects, PROJECTS_ID, validateProjects } from './projects';
import { field, useAction, useToolStore } from './shared';

export default function ProjectMembershipPanel({ note }: NotePanelProps) {
  const store = useToolStore(PROJECTS_ID, emptyProjects, validateProjects); const action = useAction();
  const [selected, setSelected] = useState('');
  const memberships = store.value.projects.filter(project => project.noteIds.includes(note.id));
  return <div className="space-y-3">{store.notice}{action.alert}
    <ul className="space-y-2">{memberships.map(project => <li key={project.id} className="space-y-1">
      <Link className="break-words underline" to={`/app/project-workspaces?project=${encodeURIComponent(project.id)}`}>{project.title}</Link>
      <p className="text-xs">{project.status}{project.evidenceIds.includes(note.id) ? ' · Evidence' : ''}{project.procedureIds.includes(note.id) ? ' · Procedure' : ''}</p>
      <button className="text-xs underline" disabled={!store.ready || action.busy || project.status === 'Archived'} onClick={() => void action.run(() => store.save(previous => ({ projects: previous.projects.map(item => item.id === project.id ? detachProjectNote(item, note.id) : item) })))}>Detach from {project.title}</button>
    </li>)}</ul>
    {!memberships.length && <p className="text-sm">This note has no project.</p>}
    <fieldset disabled={!store.ready || action.busy} className="space-y-2"><label className="block text-sm">Add note to project<select aria-label="Add note to project" className={`${field} block w-full min-w-0`} value={selected} onChange={event => setSelected(event.target.value)}><option value="">Choose project</option>{store.value.projects.filter(project => project.status !== 'Archived' && !project.noteIds.includes(note.id)).map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
      <button className={field} disabled={!selected} onClick={() => void action.run(async () => { await store.save(previous => {
        const target = previous.projects.find(project => project.id === selected);
        if (!target || target.status === 'Archived') throw new Error('This project is unavailable or archived.');
        return { projects: previous.projects.map(project => project.id === selected ? attachProjectNote(project, note.id, 'note') : project) };
      }); setSelected(''); })}>Attach to project</button>
    </fieldset>
    <Link className="text-sm underline" to="/app/project-workspaces">Manage projects</Link>
  </div>;
}
