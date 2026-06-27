import { CoreAPIImpl } from './CoreAPIImpl';
import type { FeaturePack } from './featurePack';

type PackState = 'registered' | 'mounted' | 'unmounted';

interface RegistryEntry {
  pack: FeaturePack;
  state: PackState;
}

export class FeatureRegistry {
  private readonly entries = new Map<string, RegistryEntry>();

  register(pack: FeaturePack): void {
    if (this.entries.has(pack.id)) {
      throw new Error(`Feature pack '${pack.id}' is already registered`);
    }
    this.entries.set(pack.id, { pack, state: 'registered' });
  }

  async mount(packId: string): Promise<void> {
    const entry = this.entries.get(packId);
    if (!entry) throw new Error(`Feature pack '${packId}' is not registered`);
    if (entry.state === 'mounted') return;

    const api = new CoreAPIImpl();
    if (entry.pack.capabilities.length > 0) {
      await api.requestCapabilities(entry.pack.capabilities);
    }
    await entry.pack.onMount?.(api);
    entry.state = 'mounted';
  }

  async unmount(packId: string): Promise<void> {
    const entry = this.entries.get(packId);
    if (!entry) throw new Error(`Feature pack '${packId}' is not registered`);
    if (entry.state !== 'mounted') return;

    await entry.pack.onUnmount?.();
    entry.state = 'unmounted';
  }

  getState(packId: string): PackState | undefined {
    return this.entries.get(packId)?.state;
  }

  getMounted(): FeaturePack[] {
    return [...this.entries.values()]
      .filter((e) => e.state === 'mounted')
      .map((e) => e.pack);
  }

  getAll(): FeaturePack[] {
    return [...this.entries.values()].map((e) => e.pack);
  }
}

// Module-level singleton — all packs share one registry per browser tab.
const _registry = new FeatureRegistry();

export function registerFeature(pack: FeaturePack): void {
  _registry.register(pack);
}

export async function mountFeature(packId: string): Promise<void> {
  return _registry.mount(packId);
}

export async function unmountFeature(packId: string): Promise<void> {
  return _registry.unmount(packId);
}

export function getFeatureRegistry(): FeatureRegistry {
  return _registry;
}

export type { PackState };
