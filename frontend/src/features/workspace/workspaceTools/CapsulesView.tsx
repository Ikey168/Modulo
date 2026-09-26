import { useProjectData, type ProjectData } from './useProjectData';
import { bundleNoteIds, PROJECTS_ID, projectBundle, remapProjectBundle } from './projects';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { CoreNote } from '@modulo/core';
import type { WorkspaceViewProps } from '../plugins/types';
import { usePlugins } from '../plugins/PluginProvider';
import { PACKS } from '../plugins/packs';
import { type PropertyDefinition, type PropertyValue, writePropertyFrontmatter } from '../../knowledge/propertyFrontmatter';
import { attachments, attachmentBlob, base64, fromBase64, uploadFile } from './attachments';
import { bodyOf, download, field, fingerprint, now, object, replaceNote, request, uid, useAction, useToolStore } from './shared';
import { ToolPage } from './ToolPage';
import { schemaConflicts, sensitiveLines, validateCapsule, type Capsule } from './capsules';

interface ImportJob { projectId?: string; id: string; digest: string; title: string; mapping: Record<string, number>; finishedNotes: number[]; files: number[]; links: number[]; complete: boolean }
interface CapsuleState { imports: ImportJob[] }
const empty: CapsuleState = { imports: [] };
function validateState(value: unknown): CapsuleState {
  const root = object(value);
  if (!Array.isArray(root.imports) || root.imports.length > 200) throw new Error('Invalid import history.');
  for (const raw of root.imports) { const item = object(raw); if (item.projectId !== undefined && (typeof item.projectId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(item.projectId))) throw new Error('Invalid imported project ID.'); if (typeof item.id !== 'string' || typeof item.digest !== 'string' || typeof item.title !== 'string' || typeof item.complete !== 'boolean' || !Array.isArray(item.finishedNotes) || !Array.isArray(item.files) || !Array.isArray(item.links)) throw new Error('Invalid import job.'); const mapping = object(item.mapping); if (Object.entries(mapping).some(([key, value]) => !/^[1-9]\d*$/.test(key) || !Number.isSafeInteger(value) || Number(value) < 1) || [item.finishedNotes, item.files, item.links].some(values => (values as unknown[]).some(value => !Number.isSafeInteger(value) || Number(value) < 0))) throw new Error('Invalid import progress.'); }
  return value as CapsuleState;
}
export default function CapsulesView(props: WorkspaceViewProps) {
  const plugins = usePlugins();
  return plugins.isEnabled(PROJECTS_ID) ? <ProjectCapsules {...props} /> : <CapsuleEditor {...props} />;
}
function ProjectCapsules(props: WorkspaceViewProps) {
  const projectData = useProjectData();
  return <CapsuleEditor {...props} projectData={projectData} />;
}
function CapsuleEditor({ data, onOpenNote, projectData }: WorkspaceViewProps & { projectData?: ProjectData }) {
  const plugins = usePlugins(); const store = useToolStore('workspace-capsules', empty, validateState); const action = useAction();
  const [params] = useSearchParams(); const loadedProject = useRef('');
  const projectId = params.get('project') ?? '';
  const project = projectData?.projects.value.projects.find(project => project.id === projectId);
  const [selected, setSelected] = useState<number[]>([]); const [requirements, setRequirements] = useState<string[]>(['notes-editor']);
  const [title, setTitle] = useState(''); const [includeFiles, setIncludeFiles] = useState(true); const [capsule, setCapsule] = useState<Capsule>(); const [mode, setMode] = useState<'export' | 'import'>('export'); const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    if (!project || !projectData?.ready || loadedProject.current === project.id) return;
    loadedProject.current = project.id;
    setTitle(project.title); setSelected(project.noteIds); setRequirements([PROJECTS_ID]); setCapsule(undefined); setConfirmed(false);
  }, [project, projectData?.ready]);
  const build = async () => {
    if (projectId && (!project || !projectData?.ready)) throw new Error('Enable Project Workspaces and load the project before exporting.');
    const bundle = project && projectData ? projectBundle(project, projectData.decisions.value.records, projectData.runbooks.value.runs) : undefined;
    const noteIds = bundle ? bundleNoteIds(bundle) : selected;
    const notes = data.notes.filter(note => noteIds.includes(note.id));
    if (notes.length !== noteIds.length) throw new Error('Some project notes are unavailable. Restore access or detach them before exporting.');
    if ((!notes.length && !bundle) || !title.trim()) throw new Error('Name the capsule and select notes.');
    const defs = await request<PropertyDefinition[]>('/api/note-properties/definitions');
    const properties: Capsule['properties'] = [];
    for (let offset = 0; offset < notes.length; offset += 100) properties.push(...await request<Capsule['properties']>('/api/note-properties/read', { noteIds: notes.slice(offset, offset + 100).map(note => note.id) }));
    const usedKeys = new Set(properties.flatMap(row => Object.keys(row.values)));
    const requested = bundle ? [...new Set([...requirements, PROJECTS_ID])] : requirements;
    const allRequirements = new Set(requested); const addDependencies = (id: string) => { for (const dependency of plugins.manifest(id)?.dependencies ?? []) if (!allRequirements.has(dependency)) { allRequirements.add(dependency); addDependencies(dependency); } }; requested.forEach(addDependencies);
    const files: Capsule['attachments'] = [];
    if (includeFiles) for (const note of notes) for (const file of await attachments(note.id)) {
      files.push({ sourceNoteId: note.id, name: file.originalFilename, mime: file.contentType, data: await base64(await attachmentBlob(file)) });
      if (files.reduce((sum, file) => sum + file.data.length, 0) > 25 * 1024 * 1024) throw new Error('Attachments exceed 25 MB encoded. Select fewer notes or exclude attachments.');
    }
    const next: Capsule = { format: 'modulo-capsule', version: 1, id: uid(), title: title.trim(), createdAt: now(), notes,
      project: bundle, links: data.links.filter(link => noteIds.includes(link.sourceNoteId) && noteIds.includes(link.targetNoteId)), attachments: files,
      definitions: defs.filter(def => usedKeys.has(def.key)), properties,
      plugins: [...allRequirements].map(id => { const manifest = plugins.manifest(id); if (!manifest) throw new Error(`Unknown plugin ${id}`); return { id, name: manifest.name, description: manifest.description, dependencies: manifest.dependencies ?? [] }; }),
      packs: PACKS.filter(pack => pack.pluginIds.length > 0 && pack.pluginIds.every(id => allRequirements.has(id))).map(pack => ({ id: pack.id, name: pack.name, description: pack.description, plugins: pack.pluginIds })),
    };
    setCapsule(validateCapsule(next)); setMode('export'); setConfirmed(false);
  };
  const importCapsule = async () => {
    if (!capsule || !confirmed) return;
    if (capsule.project && !projectData?.ready) throw new Error('Install and enable Project Workspaces in Marketplace before importing this project.');
    const digest = await fingerprint(capsule); const previous = store.value.imports.find(item => item.id === capsule.id);
    if (previous && previous.digest !== digest) throw new Error('This capsule ID was previously imported with different content.');
    if (previous?.complete) throw new Error('This capsule has already been imported.');
    const currentDefs = await request<PropertyDefinition[]>('/api/note-properties/definitions'); const conflicts = schemaConflicts(capsule.definitions, currentDefs);
    if (conflicts.length) throw new Error(`Incompatible property schemas: ${conflicts.join(', ')}. Existing schemas are preserved.`);
    let job: ImportJob = previous ?? { id: capsule.id, digest, title: capsule.title, mapping: {}, finishedNotes: [], files: [], links: [], complete: false };
    const save = async (patch: Partial<ImportJob>) => { job = { ...job, ...patch }; await store.save(state => ({ imports: [...state.imports.filter(item => item.id !== job.id), job] }), true); };
    await save(capsule.project && !job.projectId ? { projectId: uid() } : {});
    for (const definition of capsule.definitions) if (!currentDefs.some(def => def.key === definition.key)) await request('/api/note-properties/definitions', { ...definition, revision: 0 }, 'PUT');
    const currentNotes = await request<CoreNote[]>('/api/notes');
    for (const source of capsule.notes) if (!job.mapping[source.id]) {
      // Keep the marker until the mapping is acknowledged. An interrupted creation can be discovered on resume.
      const marker = `<!-- modulo-capsule:${capsule.id}:${source.id} -->`;
      const recovered = currentNotes.find(note => bodyOf(note).startsWith(marker + '\n'));
      const created = recovered ?? await data.createNote(`${capsule.title} / ${source.title}`, `${marker}\n${bodyOf(source)}`); if (!created) throw new Error('Could not create imported note. Reopen the capsule to resume.');
      await save({ mapping: { ...job.mapping, [source.id]: created.id } });
    }
    for (const source of capsule.notes) if (!job.finishedNotes.includes(source.id)) {
      const id = job.mapping[source.id]; const current = await request<CoreNote>(`/api/notes/${id}`);
      let markdown = bodyOf(source).replace(/\[\[([^\]#|]+)([^\]]*)\]\]/g, (whole, target: string, suffix: string) => capsule.notes.some(note => note.title === target) ? `[[${capsule.title} / ${target}${suffix}]]` : whole)
        .replace(/(```living-note\s*\n)(\d+)(\s*\n```)/g, (whole, before: string, id: string, after: string) => job.mapping[id] ? `${before}${job.mapping[id]}${after}` : whole);
      const values: Record<string, PropertyValue> = { ...(capsule.properties.find(row => row.noteId === source.id)?.values ?? {}) };
      for (const definition of capsule.definitions) if (definition.type === 'noteReference' && values[definition.key] != null) values[definition.key] = job.mapping[String(values[definition.key])];
      if (Object.keys(values).length) markdown = writePropertyFrontmatter(markdown, values, capsule.definitions);
      const updated = await replaceNote(current, { title: `${capsule.title} / ${source.title}`, content: markdown }, source.tags);
      if (Object.keys(values).length) await request('/api/note-properties/write', { changes: [{ noteId: id, version: updated.version, set: values, remove: [] }] });
      await save({ finishedNotes: [...job.finishedNotes, source.id] });
    }
    for (const [index, file] of capsule.attachments.entries()) if (!job.files.includes(index)) {
      await uploadFile(job.mapping[file.sourceNoteId], new File([fromBase64(file.data, file.mime)], file.name, { type: file.mime })); await save({ files: [...job.files, index] });
    }
    for (const [index, link] of capsule.links.entries()) if (!job.links.includes(index)) {
      if (await data.createLink(job.mapping[link.sourceNoteId], job.mapping[link.targetNoteId], link.linkType) === false) throw new Error('Relationship import failed. Reopen the capsule to resume.'); await save({ links: [...job.links, index] });
    }
    if (capsule.project && projectData && job.projectId) {
      const imported = remapProjectBundle(capsule.project, job.mapping, job.projectId);
      await projectData.decisions.save(previous => ({ ...previous, records: [...previous.records, ...imported.decisions.filter(decision => !previous.records.some(existing => existing.id === decision.id))] }), true);
      await projectData.runbooks.save(previous => ({ runs: [...previous.runs, ...imported.runs.filter(run => !previous.runs.some(existing => existing.id === run.id))] }), true);
      await projectData.projects.save(previous => ({ projects: previous.projects.some(project => project.id === imported.workspace.id) ? previous.projects : [...previous.projects, imported.workspace] }), true);
    }
    await save({ complete: true }); await data.refresh(); setConfirmed(false);
  };
  return <ToolPage title="Workspace Capsules" notice={<>{store.notice}{projectData?.projects.notice}{projectData?.decisions.notice}{projectData?.runbooks.notice}</>}>{action.alert}
    {projectId && <p role="status">{project ? `Exporting project: ${project.title}. Includes linked decisions, procedure receipts, evidence notes and their attachments.` : 'Loading project; enable Project Workspaces if it is unavailable.'} <Link className="underline" to="/app/workspace-capsules">Choose notes manually</Link></p>}
    <fieldset disabled={action.busy || !store.ready} className="space-y-3"><label className="block">Project / capsule name<input className={`${field} block w-full`} value={title} onChange={e => { setTitle(e.target.value); setCapsule(undefined); setConfirmed(false); }} /></label>
      <details open><summary>Select notes ({selected.length})</summary><div className="max-h-60 overflow-auto">{data.notes.map(note => <label key={note.id} className="flex gap-2"><input type="checkbox" disabled={!!projectId} checked={selected.includes(note.id)} onChange={e => { setSelected(previous => e.target.checked ? [...previous, note.id] : previous.filter(id => id !== note.id)); setCapsule(undefined); }} />{note.title}</label>)}</div></details>
      <details><summary>Required plugins</summary>{plugins.catalog.filter(plugin => plugins.isInstalled(plugin.id)).map(plugin => <label key={plugin.id} className="flex gap-2"><input type="checkbox" checked={requirements.includes(plugin.id)} onChange={e => { setRequirements(previous => e.target.checked ? [...previous, plugin.id] : previous.filter(id => id !== plugin.id)); setCapsule(undefined); setConfirmed(false); }} />{plugin.name}</label>)}</details>
      <label className="flex gap-2"><input type="checkbox" checked={includeFiles} onChange={e => { setIncludeFiles(e.target.checked); setCapsule(undefined); setConfirmed(false); }} />Include attachment bytes</label>
      <button className={field} onClick={() => void action.run(build)}>Prepare export preview</button>
      <label className="block">Open capsule for import<input type="file" accept="application/json,.json" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void action.run(async () => { if (file.size > 30 * 1024 * 1024) throw new Error('Capsule exceeds 30 MB.'); setCapsule(validateCapsule(JSON.parse(await file.text()))); setMode('import'); setConfirmed(false); }); }} /></label>
    </fieldset>
    {capsule && <section className="space-y-3 border-t border-border pt-4" aria-label="Capsule preview"><h2 className="font-medium">{mode === 'export' ? 'Export' : 'Import'}: {capsule.title}</h2><p>{capsule.notes.length} notes · {capsule.links.length} relationships · {capsule.attachments.length} files · {capsule.definitions.length} property schemas</p>
      <p className="text-sm">This file contains plaintext private content. Review every note and attachment before sharing. Detection below is a convenience and cannot identify every secret.</p>
      {sensitiveLines(capsule.notes).map((hit, index) => <p key={index} role="status">Review potentially sensitive content: {hit.title}, line {hit.line}.</p>)}
      {capsule.notes.map(note => <details key={note.id}><summary>{note.title}</summary><pre className="max-h-60 overflow-auto whitespace-pre-wrap text-sm">{bodyOf(note)}</pre><p>Tags: {note.tags.map(t => t.name).join(', ')}</p><pre className="whitespace-pre-wrap text-sm">{JSON.stringify(capsule.properties.find(row => row.noteId === note.id)?.values ?? {}, null, 2)}</pre></details>)}
      {capsule.attachments.map((file, index) => <p key={index}>Attachment: {file.name} · {file.mime} · about {Math.round(file.data.length * .75 / 1024)} KB</p>)}
      <details><summary>Property schemas</summary><pre className="max-h-60 overflow-auto whitespace-pre-wrap text-sm">{JSON.stringify(capsule.definitions, null, 2)}</pre></details>
      {capsule.project && <details open><summary>Project structure, decisions and runbook receipts</summary><p>{capsule.project.workspace.title} · {capsule.project.workspace.status} · {capsule.project.decisions.length} decisions · {capsule.project.runs.length} historical receipts</p><pre className="max-h-80 overflow-auto whitespace-pre-wrap text-sm">{JSON.stringify(capsule.project, null, 2)}</pre><p className="text-sm">Imported receipts are historical and cannot resume or execute workflows. New runs can be started from the imported procedure notes.</p></details>}
      <h3>Requirements</h3>{capsule.plugins.map(plugin => <p key={plugin.id}>{plugin.name} — {plugins.isInstalled(plugin.id) ? 'Installed' : 'Missing'} · dependencies: {plugin.dependencies.join(', ') || 'None'}</p>)}
      {capsule.packs.map(pack => <details key={pack.id}><summary>{pack.name} pack definition</summary><p>{pack.description}</p><p>{pack.plugins.join(', ')}</p></details>)}
      <p className="text-sm">Imports create new notes and remap internal graph and note-property references. Required plugins are reviewed and installed separately in <Link className="underline" to="/app/marketplace">Marketplace</Link>. Imported code is never executed. Saved-query IDs and external links may still point to their original workspace.</p>
      <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I reviewed the contents, attachments, schemas and requirements.</label>
      <button className={field} disabled={!confirmed || action.busy || !store.ready} onClick={() => { if (mode === 'export') download(`modulo-capsule-${capsule.id}.json`, capsule); else void action.run(importCapsule); }}>{mode === 'export' ? 'Download capsule' : 'Import / resume project'}</button>
    </section>}
    <section className="space-y-2"><h2 className="font-medium">Import history</h2>{store.value.imports.map(job => <div key={job.id}><p>{job.title} — {job.complete ? 'Complete' : 'Partial; reopen the same capsule to resume'}</p>{job.complete && job.projectId && <Link className="mr-3 underline" to={`/app/project-workspaces?project=${job.projectId}`}>Open imported project</Link>}{job.complete && <button className="text-sm underline" disabled={action.busy || !store.ready} onClick={() => { if (window.confirm('Remove this completed import receipt? Imported notes are retained; the capsule can then be imported again.')) void action.run(() => store.save(previous => ({ imports: previous.imports.filter(item => item.id !== job.id) }))); }}>Remove import receipt</button>}{Object.values(job.mapping).map(id => <button key={id} className="mr-3 underline" onClick={() => onOpenNote(id)}>Note #{id}</button>)}</div>)}</section>
  </ToolPage>;
}
