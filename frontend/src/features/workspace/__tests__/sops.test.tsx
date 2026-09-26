import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryWorkspace } from '../../../__tests__/helpers/memoryWorkspaceState';
import { PersonalSopsView } from '../PersonalSopsView';
import { emptySops, finishSopRun, parseSops, SOPS_STORE_KEY, startSopRun, type SopData, type SopProcedure } from '../sops';
import { collectLifeOsEntities, createLifeOsBackup, planLifeOsRestore } from '../lifeOs';
import type { WorkspaceViewProps } from '../plugins/types';
import { restoreWorkspaceBackup } from '../restoreWorkspace';
import type { CoreNote } from '@modulo/core';
import { CATALOG } from '../plugins/catalog';

const memory = vi.hoisted(() => ({ current: undefined as unknown as ReturnType<typeof createMemoryWorkspace> }));
vi.mock('../plugins/PluginProvider', () => ({ usePlugins: () => memory.current.api }));
/** Let the server store open/sync so edits reach (and come back from) the in-memory server. */
const settle = () => act(async () => { await memory.current.flush(); await new Promise((resolve) => setTimeout(resolve, 0)); });
const readSops = (): SopData => parseSops(memory.current.value('personal-sops', 'data') ?? emptySops());

const procedure = (): SopProcedure => ({ id: 'p1', title: 'Weekly backup', description: 'Protect the workspace', steps: ['Export', 'Verify'], noteIds: [7], archived: false, updatedAt: '2026-09-05T10:00:00Z' });
beforeEach(() => {
  localStorage.clear();
  memory.current = createMemoryWorkspace();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Personal SOPs', () => {
  it('snapshots each run independently of template changes and other runs', () => {
    const p = procedure();
    const first = startSopRun(p);
    const second = startSopRun(p);
    p.title = 'Changed'; p.steps[0] = 'Changed'; p.noteIds.push(9);
    first.steps[0].done = true;
    expect(first.title).toBe('Weekly backup');
    expect(first.steps[0].title).toBe('Export');
    expect(first.noteIds).toEqual([7]);
    expect(second.steps[0].done).toBe(false);
    expect(second.id).not.toBe(first.id);
  });
  it('requires all steps to complete, retains cancelled progress, and cannot restart archived procedures', () => {
    const run = startSopRun(procedure());
    expect(() => finishSopRun(run, 'Completed')).toThrow('Complete every step');
    run.steps[0].done = true;
    const cancelled = finishSopRun(run, 'Cancelled');
    expect(cancelled.steps[0].done).toBe(true);
    expect(cancelled.finishedAt).toBeTruthy();
    expect(finishSopRun(cancelled, 'Completed')).toBe(cancelled);
    expect(() => startSopRun({ ...procedure(), archived: true })).toThrow();
    run.steps.forEach((s) => { s.done = true; });
    expect(finishSopRun(run, 'Completed').status).toBe('Completed');
  });
  it('includes procedures and runs in search and round-trips through portable backups', () => {
    const p = procedure();
    const data = { ...emptySops(), procedures: [p], runs: [startSopRun(p)] };
    const stores = { [SOPS_STORE_KEY]: JSON.parse(JSON.stringify(data)) };
    expect(collectLifeOsEntities([], stores).filter((e) => e.source === 'Personal SOPs').map((e) => e.kind)).toEqual(['Procedure', 'Procedure run']);
    const backup = createLifeOsBackup([], [], [], stores);
    const planned = planLifeOsRestore(backup, {}).planned.find((item) => item.key === SOPS_STORE_KEY);
    expect(parseSops(planned?.value)).toEqual(data);
    const invalid = { ...backup, stores: { [SOPS_STORE_KEY]: { ...data, procedures: [{ ...p, steps: [] }] } } };
    expect(() => planLifeOsRestore(invalid, {}, true)).toThrow('Invalid procedure');
  });
  it('remaps linked notes on both procedures and run snapshots when restoring to a new workspace', async () => {
    const p = procedure();
    const stores = { [SOPS_STORE_KEY]: { ...emptySops(), procedures: [p], runs: [startSopRun(p)] } };
    const backup = createLifeOsBackup([{ id: 7, title: 'Instructions', content: 'Steps', tags: [] } as CoreNote], [], [], stores);
    let restored: Record<string, unknown> = {};
    await restoreWorkspaceBackup(backup, [], async (title, content) => ({ id: 70, title, content } as CoreNote), false, undefined,
      { current: {}, restoreServer: async (planned) => { restored = planned; return Object.keys(planned); } });
    const sops = parseSops(restored[SOPS_STORE_KEY]);
    expect(sops.procedures[0].noteIds).toEqual([70]);
    expect(sops.runs[0].noteIds).toEqual([70]);
  });
  it('refuses to overwrite an invalid server record with an empty collection', async () => {
    expect(() => parseSops({ ...emptySops(), runs: [{ id: 'invalid' }] })).toThrow();
    memory.current.seed('personal-sops', 'data', { ...emptySops(), runs: [{ id: 'invalid' }] }, 'modulo.workspace.personal-sops');
    render(<PersonalSopsView {...({ data: { notes: [] } } as unknown as WorkspaceViewProps)} />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'New procedure' })[0]).toBeInTheDocument());
    await memory.current.flush();
    expect(memory.current.value('personal-sops', 'data')).toEqual({ ...emptySops(), runs: [{ id: 'invalid' }] });
  });
  it('is installable and registers its Planning view', async () => {
    const manifest = CATALOG.find((p) => p.id === 'personal-sops')!;
    expect(manifest.dependencies).toContain('notes-editor');
    const loaded = await manifest.load!();
    const module = 'default' in loaded ? loaded.default : loaded;
    const addView = vi.fn();
    await module.activate({ state: async () => { throw new Error('State not used by this fixture'); },
      addView, addNotePanel: vi.fn(), addNoteFence: vi.fn(), addEditorAction: vi.fn(), addBlueprintNode: vi.fn() });
    expect(addView).toHaveBeenCalledWith(expect.objectContaining({ id: 'personal-sops', mode: 'productivity' }));
  });
  it('creates, resumes after remount, records evidence, completes and archives without losing history', async () => {
    const props = { data: { notes: [{ id: 7, title: 'Backup instructions' }] }, onOpenNote: vi.fn() } as unknown as WorkspaceViewProps;
    const view = render(<PersonalSopsView {...props} />);
    await settle();
    fireEvent.click(screen.getAllByRole('button', { name: 'New procedure' })[0]);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Backup' } });
    fireEvent.change(screen.getByLabelText('Steps'), { target: { value: 'Export\nVerify' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save procedure' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start run' }));
    expect(screen.getByRole('button', { name: 'Complete run' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: '1. Export' }));
    await settle();
    view.unmount();
    render(<PersonalSopsView {...props} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /Backup Active/ }));
    expect(screen.getByRole('checkbox', { name: '1. Export' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Edit run notes & links' }));
    fireEvent.change(screen.getByLabelText('Run notes'), { target: { value: 'Restore verified.' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Backup instructions' }));
    expect(screen.queryByRole('button', { name: 'Complete run' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save run notes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Backup instructions' }));
    expect(props.onOpenNote).toHaveBeenCalledWith(7);
    fireEvent.click(screen.getByRole('checkbox', { name: '2. Verify' }));
    fireEvent.click(screen.getByRole('button', { name: 'Complete run' }));
    await settle();
    expect(readSops().runs[0]).toMatchObject({ status: 'Completed', notes: 'Restore verified.', noteIds: [7] });
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await settle();
    expect(readSops().procedures[0].archived).toBe(true);
    expect(readSops().runs).toHaveLength(1);
  });
  it('keeps the procedure draft open when the server store is not ready yet', async () => {
    memory.current.api.workspaceState = () => new Promise(() => {});
    render(<PersonalSopsView {...({ data: { notes: [] } } as unknown as WorkspaceViewProps)} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'New procedure' })[0]);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Draft' } });
    fireEvent.change(screen.getByLabelText('Steps'), { target: { value: 'Do something' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save procedure' }));
    expect(screen.getByRole('alert')).toHaveTextContent('could not be saved');
    expect(screen.getByLabelText('Title')).toHaveValue('Draft');
    expect(readSops().procedures).toHaveLength(0);
  });
  it('saves a new procedure to the server', async () => {
    render(<PersonalSopsView {...({ data: { notes: [] } } as unknown as WorkspaceViewProps)} />);
    await settle();
    fireEvent.click(screen.getAllByRole('button', { name: 'New procedure' })[0]);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Draft' } });
    fireEvent.change(screen.getByLabelText('Steps'), { target: { value: 'Do something' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save procedure' }));
    await settle();
    expect(readSops().procedures[0].title).toBe('Draft');
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  });
});
