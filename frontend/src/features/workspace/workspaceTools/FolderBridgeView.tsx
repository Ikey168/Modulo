import { useState } from 'react';
import type { CoreNote } from '@modulo/core';
import type { WorkspaceViewProps } from '../plugins/types';
import { field, fingerprint, replaceNote, request, useAction, useToolStore } from './shared';
import { ToolPage } from './ToolPage';
import { decodeNote, emptyBridge, encodeNote, readLocal, safePath, scanDirectory, syncDirection, validateBridge, writeLocal, type FolderBinding, type LocalDirectory, type LocalFile, type SyncDirection } from './folderBridge';
import { attachmentBlob, attachments, uploadFile } from './attachments';

interface SyncRow { path: string; direction: SyncDirection; source?: string; fileHash?: string; noteHash?: string; note?: CoreNote; binding?: FolderBinding }
export default function FolderBridgeView({ data }: WorkspaceViewProps) {
  const store = useToolStore('local-folder-bridge', emptyBridge, validateBridge); const action = useAction();
  const [directory, setDirectory] = useState<LocalDirectory>(); const [files, setFiles] = useState(new Map<string, LocalFile>());
  const [rows, setRows] = useState<SyncRow[]>([]); const [selectedNotes, setSelectedNotes] = useState<number[]>([]);
  const picker = (window as unknown as { showDirectoryPicker?: (options: { mode: string }) => Promise<LocalDirectory> }).showDirectoryPicker;
  const preview = async (root = directory) => {
    if (!root) throw new Error('Choose a folder first.');
    setRows([]);
    const latestNotes = await request<CoreNote[]>('/api/notes');
    const found = await scanDirectory(root); setFiles(found); const result: SyncRow[] = []; let total = 0;
    for (const [path, handle] of found) {
      if (!/\.md$/i.test(path)) continue;
      const file = await handle.getFile(); total += file.size;
      if (file.size > 200000 || total > 10000000) throw new Error('Markdown preview limit: 200 KB per note and 10 MB total.');
      const source = await file.text(); const fileHash = await fingerprint(source);
      const binding = store.value.bindings.find(item => item.path === path); const note = latestNotes.find(n => n.id === binding?.noteId);
      const noteHash = note ? await fingerprint(encodeNote(note)) : undefined;
      result.push({ path, source, fileHash, noteHash, note, binding, direction: binding ? syncDirection(binding, fileHash, noteHash) : 'import' });
    }
    for (const binding of store.value.bindings.filter(binding => !found.has(binding.path))) result.push({ path: binding.path, binding, note: latestNotes.find(n => n.id === binding.noteId), direction: 'missing' });
    for (const note of latestNotes.filter(note => selectedNotes.includes(note.id) && !store.value.bindings.some(b => b.noteId === note.id))) {
      let path = `modulo-${note.id}.md`; let suffix = 1;
      while (found.has(path) || result.some(row => row.path === path)) path = `modulo-${note.id}-${suffix++}.md`;
      result.push({ path, note, noteHash: await fingerprint(encodeNote(note)), direction: 'export' });
    }
    setRows(result);
  };
  const apply = async (row: SyncRow, direction: 'import' | 'export') => {
    if (!directory) throw new Error('Folder unavailable.');
    const existing = await readLocal(directory, row.path); const latest = existing ? await existing.text() : undefined;
    if (row.fileHash && await fingerprint(latest) !== row.fileHash) throw new Error('The local file changed after preview. Scan again.');
    if (!row.fileHash && latest !== undefined) throw new Error('A local file now occupies this path. Scan again.');
    let note = row.note; let disk = row.source;
    if (direction === 'import') {
      if (disk === undefined) throw new Error('The file is missing. No deletion is propagated.');
      const decoded = decodeNote(row.path, disk);
      if (note) note = await replaceNote(note, decoded);
      else { const created = await data.createNote(decoded.title, decoded.content); if (!created) throw new Error('Could not create note.'); note = created; }
    } else {
      if (!note) throw new Error('Note unavailable.');
      const current = await request<CoreNote>(`/api/notes/${note.id}`);
      if (await fingerprint(encodeNote(current)) !== await fingerprint(encodeNote(note))) throw new Error('The note changed after preview. Scan again.');
      disk = encodeNote(note); await writeLocal(directory, row.path, disk);
    }
    const binding = { path: row.path, noteId: note!.id, fileHash: await fingerprint(disk), noteHash: await fingerprint(encodeNote(note!)) };
    await store.save(previous => ({ folder: directory.name, bindings: [...previous.bindings.filter(old => old.path !== row.path), binding] }));
    setRows(previous => previous.filter(item => item.path !== row.path)); await data.refresh();
  };
  return <ToolPage title="Local Folder Bridge" notice={store.notice}>{action.alert}
    <p className="text-sm">Choose a folder in a browser supporting directory access (Chromium). Scan, review, then apply each change. Reconnect the same folder after reloading. Missing files and notes are never automatically deleted.</p>
    {!picker && <p role="status">Directory access is unavailable in this browser. Open Modulo in a Chromium browser to synchronize local files.</p>}
    <fieldset disabled={!store.ready || action.busy} className="space-y-3"><div className="flex flex-wrap gap-2"><button className={field} disabled={!picker} onClick={() => void action.run(async () => {
      const chosen = await picker!({ mode: 'readwrite' });
      if (store.value.folder && !window.confirm(`Reconnect the exact folder previously named “${store.value.folder}”? Choosing a different folder can create conflicts.`)) return;
      setDirectory(chosen); setRows([]); setFiles(new Map());
    })}>Choose folder</button><button className={field} disabled={!directory} onClick={() => void action.run(() => preview())}>Scan and preview</button></div>
      <button className={field} disabled={!store.value.bindings.length} onClick={() => { if (window.confirm('Disconnect all bindings to connect a different folder? Notes and local files are retained.')) void action.run(async () => { await store.save(emptyBridge); setDirectory(undefined); setRows([]); setFiles(new Map()); }); }}>Disconnect folder</button>
      <p>{directory?.name ?? 'No folder connected'}</p><details><summary>Include additional notes for export</summary><div className="max-h-52 overflow-auto">{data.notes.filter(note => !store.value.bindings.some(b => b.noteId === note.id)).map(note => <label key={note.id} className="flex gap-2"><input type="checkbox" checked={selectedNotes.includes(note.id)} onChange={e => setSelectedNotes(previous => e.target.checked ? [...previous, note.id] : previous.filter(id => id !== note.id))} />{note.title}</label>)}</div></details>
      <label className="block">Export attachments from a synchronized note<select className={field} disabled={!directory} value="" onChange={e => { const id = Number(e.target.value); if (id && directory) void action.run(async () => {
        for (const file of await attachments(id)) {
          const path = `modulo-assets/${id}/${file.id}-${file.originalFilename.replace(/[^\p{L}\p{N}._-]/gu, '_')}`;
          if (await readLocal(directory, path)) throw new Error(`File already exists: ${path}. Existing files are preserved.`);
          await writeLocal(directory, path, await attachmentBlob(file));
        }
      }); }}><option value="">Choose note…</option>{store.value.bindings.map(binding => <option key={binding.path} value={binding.noteId}>{binding.path}</option>)}</select></label>
      <ul className="divide-y divide-border">{rows.map(row => <li key={row.path} className="space-y-2 py-3"><p>{row.path} — {row.direction}</p><details><summary>Compare content</summary><div className="grid gap-3 sm:grid-cols-2"><pre className="max-h-60 overflow-auto whitespace-pre-wrap text-xs">Folder: {row.source ?? 'No file'}</pre><pre className="max-h-60 overflow-auto whitespace-pre-wrap text-xs">Modulo: {row.note ? encodeNote(row.note) : 'No note'}</pre></div></details>
        {(row.direction === 'import' || row.direction === 'conflict' || row.direction === 'missing') && row.source !== undefined && <button className={field} onClick={() => void action.run(() => apply(row, 'import'))}>Use folder version</button>}
        {(row.direction === 'export' || row.direction === 'conflict' || row.direction === 'missing') && row.note && <button className={`${field} ml-2`} onClick={() => void action.run(() => apply(row, 'export'))}>Use Modulo version</button>}
        {row.direction === 'missing' && <p className="text-sm">Retain the surviving copy or remove this binding to import the file as a new note on the next scan.</p>}
        {row.binding && <button className={`${field} ml-2`} onClick={() => { if (window.confirm('Stop synchronizing this binding? Both copies are retained.')) void action.run(async () => { await store.save(previous => ({ ...previous, bindings: previous.bindings.filter(b => b.path !== row.path) })); setRows(previous => previous.filter(item => item !== row)); }); }}>Disconnect file</button>}
      </li>)}</ul>
      <details><summary>Import an attachment from this folder</summary><p className="text-sm">Attach selected local assets to a synchronized note. Existing relative Markdown references stay unchanged; attachments are also available from the note.</p>{[...files].filter(([path]) => !/\.md$/i.test(path)).map(([path, handle]) => <label key={path} className="block py-2">{path}<select className={field} value="" onChange={e => { const id = Number(e.target.value); if (id) void action.run(async () => { safePath(path); await uploadFile(id, await handle.getFile()); }); }}><option value="">Attach to note…</option>{store.value.bindings.map(binding => <option key={binding.path} value={binding.noteId}>{binding.path}</option>)}</select></label>)}</details>
    </fieldset>
  </ToolPage>;
}
