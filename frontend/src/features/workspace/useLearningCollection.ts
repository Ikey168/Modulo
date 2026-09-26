import { useCallback, useState } from 'react';
import type { LifeCollectionData } from './lifeStore';
import { useLifeCollection } from './useLifeCollection';

/** Server-backed learning collection with the historical commit/error surface. */
export function useLearningCollection(pluginId: string) {
  const [data, persist] = useLifeCollection(pluginId);
  const [error, setError] = useState('');
  const commit = useCallback((update: (current: LifeCollectionData) => LifeCollectionData): boolean => {
    try {
      // The server store reports a rejected update as `false`; keep the validation message for the user.
      let rejected: unknown;
      const accepted = persist((current) => {
        try { return update(current); } catch (cause) { rejected = cause; throw cause; }
      });
      if (rejected) throw rejected;
      if (!accepted) throw new Error('Could not queue the server-backed change. Retry after synchronization recovers.');
      setError('');
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save changes.');
      return false;
    }
  }, [persist]);
  return { data, commit, error, setError };
}
