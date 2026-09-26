import type { Page } from '@playwright/test';
import { installWorkspaceFixture } from './workspaceApi';
import type { CoreNote } from '../../src/core/types';

export const workspaceToolIds = ['notes-editor', 'executable-runbooks', 'universal-inbox', 'workspace-time-machine', 'local-folder-bridge', 'workspace-briefings', 'living-documents', 'workspace-capsules', 'decision-journal'];
export async function installWorkspaceToolsFixture(page: Page, additional: string[] = []) {
  const records = await installWorkspaceFixture(page, [...workspaceToolIds, ...additional]);
  const notes: CoreNote[] = [{ id: 1, title: 'Release procedure', content: '- [ ] Inspect inputs\n- [ ] Review [blueprint:review#manual]', tags: [], version: 1 }, { id: 2, title: 'Project evidence', content: 'The acceptance checks passed.', tags: [], version: 1 }];
  const requests: { path: string; body: Record<string, unknown> }[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname; const method = route.request().method();
    const body = method === 'POST' || method === 'PUT' ? route.request().postDataJSON() : undefined;
    if (path.startsWith('/api/workspaces/')) return route.fallback();
    if (path === '/api/notes' && method === 'GET') return route.fulfill({ json: notes });
    if (path === '/api/notes' && method === 'POST') { const note = { id: Math.max(...notes.map(n => n.id)) + 1, title: body.title, content: body.content ?? '', tags: [], version: 1 }; notes.push(note); return route.fulfill({ json: note }); }
    const match = /^\/api\/notes\/(\d+)(\/tags)?$/.exec(path);
    if (match) {
      const index = notes.findIndex(note => note.id === Number(match[1])); if (index < 0) return route.fulfill({ status: 404, json: {} });
      if (method === 'GET') return route.fulfill({ json: notes[index] });
      if (match[2]) notes[index].tags.push({ id: String(notes[index].tags.length + 1), name: body.tagName });
      else { if (body.version !== notes[index].version) return route.fulfill({ status: 409, json: {} }); notes[index] = { ...notes[index], ...body, version: notes[index].version! + 1 }; }
      return route.fulfill({ json: notes[index] });
    }
    if (path === '/api/note-properties/definitions') return route.fulfill({ json: [] });
    if (path === '/api/note-properties/read') return route.fulfill({ json: body.noteIds.map((id: number) => ({ noteId: id, version: notes.find(note => note.id === id)?.version, values: {} })) });
    if (path === '/api/blueprints/review/run') { requests.push({ path, body }); return route.fulfill({ json: { runId: '00000000-0000-0000-0000-000000000001' } }); }
    if (/^\/api\/workflow-runs\//.test(path) && !path.endsWith('/summary')) return route.fulfill({ json: { run: { state: 'SUCCEEDED' }, steps: [] } });
    if (path === '/api/workflow-runs') return route.fulfill({ json: { items: [] } });
    return route.fallback();
  });
  return { notes, records, requests };
}
