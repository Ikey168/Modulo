import { Capacitor } from '@capacitor/core';
import type { StatePersistence, StateSnapshot } from './pluginStateClient';
import { IndexedDbStatePersistence } from './pluginStateTransport';
import { nativeStateCache, type NativeStateCacheBridge } from './nativeStateCacheBridge';

/** Android persists the complete queue in a SQLite transaction before resolving a write. */
export class AndroidStatePersistence implements StatePersistence {
  constructor(private readonly cache: Pick<NativeStateCacheBridge, 'load' | 'save'> = nativeStateCache) {}

  async load(partition: string): Promise<StateSnapshot | null> {
    const { snapshot } = await this.cache.load({ partition });
    return snapshot === null ? null : JSON.parse(snapshot) as StateSnapshot;
  }

  async save(partition: string, snapshot: StateSnapshot): Promise<void> {
    if (snapshot.partition !== partition) throw new Error('Plugin state cache partition mismatch.');
    await this.cache.save({ partition, snapshot: JSON.stringify(snapshot) });
  }
}

/** Android's single WebView reuses one durable queue identity after process death. */
export async function androidStateReplica(cache: Pick<NativeStateCacheBridge, 'replica'> = nativeStateCache): Promise<string> {
  const { replica } = await cache.replica();
  if (!replica || typeof replica !== 'string') throw new Error('Android state replica is unavailable.');
  return replica;
}

export function createStatePersistence(): StatePersistence {
  return Capacitor.getPlatform() === 'android' ? new AndroidStatePersistence() : new IndexedDbStatePersistence();
}
