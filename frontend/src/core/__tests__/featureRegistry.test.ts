import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureRegistry } from '../featureRegistry';
import type { FeaturePack } from '../featurePack';

// CoreAPIImpl must be mocked so the registry tests don't hit real APIs.
vi.mock('../CoreAPIImpl', () => ({
  CoreAPIImpl: vi.fn().mockImplementation(() => ({
    requestCapabilities: vi.fn().mockResolvedValue([]),
  })),
}));

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makePack(overrides: Partial<FeaturePack> = {}): FeaturePack {
  return {
    id: 'com.test.pack',
    name: 'Test Pack',
    version: '0.1.0',
    capabilities: [],
    onMount: vi.fn(),
    onUnmount: vi.fn(),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FeatureRegistry', () => {
  let registry: FeatureRegistry;

  beforeEach(() => {
    registry = new FeatureRegistry();
  });

  describe('register()', () => {
    it('adds the pack with state "registered"', () => {
      const pack = makePack();
      registry.register(pack);
      expect(registry.getState(pack.id)).toBe('registered');
    });

    it('throws when the same id is registered twice', () => {
      const pack = makePack();
      registry.register(pack);
      expect(() => registry.register(pack)).toThrow(/already registered/);
    });

    it('lists the pack in getAll()', () => {
      const pack = makePack();
      registry.register(pack);
      expect(registry.getAll()).toContain(pack);
    });
  });

  describe('mount()', () => {
    it('calls onMount with a CoreAPI and transitions state to "mounted"', async () => {
      const pack = makePack();
      registry.register(pack);
      await registry.mount(pack.id);

      expect(pack.onMount).toHaveBeenCalledOnce();
      expect(registry.getState(pack.id)).toBe('mounted');
    });

    it('lists the pack in getMounted() only after mount', async () => {
      const pack = makePack();
      registry.register(pack);
      expect(registry.getMounted()).not.toContain(pack);

      await registry.mount(pack.id);
      expect(registry.getMounted()).toContain(pack);
    });

    it('is idempotent — onMount is not called twice', async () => {
      const pack = makePack();
      registry.register(pack);
      await registry.mount(pack.id);
      await registry.mount(pack.id);

      expect(pack.onMount).toHaveBeenCalledOnce();
    });

    it('throws when the pack id is unknown', async () => {
      await expect(registry.mount('unknown.id')).rejects.toThrow(/not registered/);
    });

    it('calls requestCapabilities when the pack declares capabilities', async () => {
      const { CoreAPIImpl } = await import('../CoreAPIImpl');
      const mockApi = { requestCapabilities: vi.fn().mockResolvedValue([]) };
      vi.mocked(CoreAPIImpl).mockImplementationOnce(() => mockApi as any);

      const pack = makePack({ capabilities: ['notes:write'] });
      registry.register(pack);
      await registry.mount(pack.id);

      expect(mockApi.requestCapabilities).toHaveBeenCalledWith(['notes:write']);
    });
  });

  describe('unmount()', () => {
    it('calls onUnmount and transitions state to "unmounted"', async () => {
      const pack = makePack();
      registry.register(pack);
      await registry.mount(pack.id);
      await registry.unmount(pack.id);

      expect(pack.onUnmount).toHaveBeenCalledOnce();
      expect(registry.getState(pack.id)).toBe('unmounted');
    });

    it('is a no-op when the pack is not mounted', async () => {
      const pack = makePack();
      registry.register(pack);
      await registry.unmount(pack.id); // state is 'registered', not 'mounted'

      expect(pack.onUnmount).not.toHaveBeenCalled();
    });

    it('removes the pack from getMounted()', async () => {
      const pack = makePack();
      registry.register(pack);
      await registry.mount(pack.id);
      await registry.unmount(pack.id);

      expect(registry.getMounted()).not.toContain(pack);
    });

    it('throws when the pack id is unknown', async () => {
      await expect(registry.unmount('unknown.id')).rejects.toThrow(/not registered/);
    });
  });

  describe('full lifecycle: register → mount → unmount', () => {
    it('runs the complete lifecycle in order', async () => {
      const calls: string[] = [];
      const pack = makePack({
        onMount: vi.fn().mockImplementation(async () => { calls.push('mount'); }),
        onUnmount: vi.fn().mockImplementation(async () => { calls.push('unmount'); }),
      });

      registry.register(pack);
      expect(registry.getState(pack.id)).toBe('registered');

      await registry.mount(pack.id);
      expect(registry.getState(pack.id)).toBe('mounted');

      await registry.unmount(pack.id);
      expect(registry.getState(pack.id)).toBe('unmounted');

      expect(calls).toEqual(['mount', 'unmount']);
    });
  });
});
