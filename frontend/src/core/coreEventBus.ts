// Lightweight in-process event bus for ModuloCoreAPI (#294).
// Fires domain events (note.saved, link.created, …) after successful API calls
// so packs subscribed via api.on() are notified without polling.

import type { CoreEventListener, CoreEventType, Unsubscribe } from './types';

export class CoreEventBus {
  private readonly listeners = new Map<string, Set<CoreEventListener>>();

  on(event: CoreEventType, listener: CoreEventListener): Unsubscribe {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
    };
  }

  emit(event: CoreEventType, payload: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) {
      try {
        listener(payload);
      } catch {
        // A listener error must never crash other listeners or the caller.
      }
    }
  }
}
