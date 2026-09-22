import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }));
vi.mock('../api', () => ({ apiClient: api }));
import { ResearchWithNoesis } from '../ResearchWithNoesis';
import { ResearchResultCard } from '../ResearchResultCard';
import { objectReference, type ResearchRecord } from '../model';
const fixture = { key: 'research-123', version: 1, value: { id: 'research-123', question: 'Firefox policies', domain: 'technology', createdAt: '2026-09-21', refreshedAt: '2026-09-21', runId: 'noesis-run-1', runReference: '/api/v1/kb/technology/answer', policy: {}, references: [], history: [], outputs: [], snapshot: { status: 'refused', findings: [], sources: [], coverageGaps: ['No cited evidence.'], assumptions: [], refusal: 'Insufficient evidence' }, delta: { kind: 'baseline', material: false, findings: { added: [], removed: [], changed: [] }, sources: { added: [], removed: [], changed: [] } } } } as unknown as ResearchRecord;
beforeEach(() => { vi.clearAllMocks(); api.get.mockImplementation((url: string) => Promise.resolve(url.endsWith('/domains') ? [{ name: 'technology', description: 'Public technology corpus' }] : { records: [] })); });
describe('Noesis research journey', () => {
  it('requires public-question review and reuses the request ID after a lost response', async () => {
    api.put.mockRejectedValueOnce(new Error('lost response')).mockResolvedValue(fixture);
    render(<ResearchWithNoesis expanded reference={{ id: 'note-1', kind: 'note', title: 'Private note title', route: '/app/notes?note=1' }} />);
    const question = await screen.findByLabelText('Research question');
    fireEvent.change(question, { target: { value: 'Firefox policies' } });
    const run = screen.getByRole('button', { name: 'Run research' }); expect(run).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox')); await waitFor(() => expect(run).toBeEnabled()); fireEvent.click(run);
    await screen.findByRole('alert'); fireEvent.click(run);
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
    expect(api.put.mock.calls[0][0]).toBe(api.put.mock.calls[1][0]);
    expect(api.put.mock.calls[0][1]).toMatchObject({ question: 'Firefox policies', publicQuestionConfirmed: true });
    expect(api.put.mock.calls[0][1]).not.toHaveProperty('body');
  });
  it('shows refusal and does not allow creating work without evidence', () => {
    render(<ResearchResultCard record={fixture} onChange={vi.fn()} />);
    expect(screen.getByText('Insufficient evidence')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create linked work', hidden: true })).toBeDisabled();
  });
  it('refreshes with version and stable retry key', async () => {
    api.post.mockRejectedValueOnce(new Error('network')).mockResolvedValue({ ...fixture, version: 2 });
    render(<ResearchResultCard record={fixture} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh research' })); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh research' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(api.post.mock.calls[0][1]).toEqual(api.post.mock.calls[1][1]);
    expect(api.post.mock.calls[0][1].expectedVersion).toBe(1);
  });
  it('links PARA records using stable entity identity', () => {
    const ref = objectReference({ id: 'proj-1', outcome: 'Outcome', areaIds: [] }, 'Project');
    expect(ref).toMatchObject({ kind: 'project', id: 'proj-1' });
    expect(decodeURIComponent(ref!.route)).toContain('modulo-modified-para-v1:projects:proj-1');
    expect(objectReference({ id: 'modulo-modified-para-v1:tasks:task-1' }, 'Task')).toMatchObject({ kind: 'task', id: 'task-1' });
  });
});
