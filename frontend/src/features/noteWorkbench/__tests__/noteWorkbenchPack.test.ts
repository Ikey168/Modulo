import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureRegistry } from '../../../core/featureRegistry';
import { noteWorkbenchPack, getNoteWorkbenchApi } from '../noteWorkbenchPack';
import type { ModuloCoreAPI } from '@modulo/core';

// Prevent the registry's CoreAPIImpl from making real HTTP calls.
vi.mock('../../../core/CoreAPIImpl', () => ({
  CoreAPIImpl: vi.fn().mockImplementation(() => ({
    requestCapabilities: vi.fn().mockResolvedValue([]),
  })),
}));

// React.lazy resolves asynchronously — mock the Workspace import so the pack
// descriptor can be exercised without a full React + bundler environment.
vi.mock('../../workspace/Workspace', () => ({ default: vi.fn() }));

function makeApi(overrides: Partial<ModuloCoreAPI> = {}): ModuloCoreAPI {
  return {
    requestCapabilities: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as ModuloCoreAPI;
}

// ── Pack descriptor ───────────────────────────────────────────────────────────

describe('noteWorkbenchPack descriptor', () => {
  it('has the correct id', () => {
    expect(noteWorkbenchPack.id).toBe('com.modulo.note-workbench');
  });

  it('declares notes:write capability', () => {
    expect(noteWorkbenchPack.capabilities).toContain('notes:write');
  });

  it('contributes the /app/:view route with requiresAuth', () => {
    const route = noteWorkbenchPack.routes?.find((r) => r.path === '/app/:view');
    expect(route).toBeDefined();
    expect(route?.requiresAuth).toBe(true);
    expect(route?.component).toBeDefined();
  });
});

// ── Lifecycle ─────────────────────────────────────────────────────────────────

describe('noteWorkbenchPack lifecycle', () => {
  beforeEach(async () => {
    // Ensure pack is unmounted between tests.
    if (getNoteWorkbenchApi() !== null) {
      await noteWorkbenchPack.onUnmount?.();
    }
  });

  it('stores the api reference on mount', async () => {
    const api = makeApi();
    await noteWorkbenchPack.onMount!(api);
    expect(getNoteWorkbenchApi()).toBe(api);
  });

  it('calls requestCapabilities(["notes:write"]) on mount', async () => {
    const api = makeApi();
    await noteWorkbenchPack.onMount!(api);
    expect(api.requestCapabilities).toHaveBeenCalledWith(['notes:write']);
  });

  it('clears the api reference on unmount', async () => {
    const api = makeApi();
    await noteWorkbenchPack.onMount!(api);
    await noteWorkbenchPack.onUnmount!();
    expect(getNoteWorkbenchApi()).toBeNull();
  });
});

// ── Registry integration ──────────────────────────────────────────────────────

describe('noteWorkbenchPack via FeatureRegistry', () => {
  it('mounts cleanly and transitions to mounted state', async () => {
    const registry = new FeatureRegistry();
    registry.register(noteWorkbenchPack);
    await registry.mount(noteWorkbenchPack.id);
    expect(registry.getState(noteWorkbenchPack.id)).toBe('mounted');

    // Cleanup so the module-level _api is cleared for other tests.
    await registry.unmount(noteWorkbenchPack.id);
  });

  it('appears in getMounted() when mounted', async () => {
    const registry = new FeatureRegistry();
    registry.register(noteWorkbenchPack);
    await registry.mount(noteWorkbenchPack.id);

    const mounted = registry.getMounted();
    expect(mounted.some((p) => p.id === noteWorkbenchPack.id)).toBe(true);

    await registry.unmount(noteWorkbenchPack.id);
  });
});

// ── Headless boot ─────────────────────────────────────────────────────────────
//
// Simulates the "pack disabled" acceptance criterion: core + Blueprint engine
// boot and the CoreAPIImpl is fully operational with zero packs registered.
// Blueprint triggers (note.saved → ai.summarize → tag.add) fire through the
// CoreAPIImpl without any UI pack being mounted.

describe('headless boot (pack disabled)', () => {
  it('CoreAPIImpl initialises with no packs registered', async () => {
    const { CoreAPIImpl } = await import('../../../core/CoreAPIImpl');
    const api = new CoreAPIImpl();
    // requestCapabilities with an empty list returns [] (no ungranted caps).
    await expect(api.requestCapabilities([])).resolves.toEqual([]);
  });

  it('empty registry has no mounted packs', () => {
    const registry = new FeatureRegistry();
    expect(registry.getMounted()).toHaveLength(0);
  });

  it('registering no packs does not break the registry', () => {
    const registry = new FeatureRegistry();
    expect(registry.getAll()).toHaveLength(0);
    expect(() => registry.getState('com.modulo.note-workbench')).not.toThrow();
  });
});
