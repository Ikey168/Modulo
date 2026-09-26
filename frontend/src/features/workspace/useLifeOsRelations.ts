import { useCallback } from 'react';
import { withoutRelationsFor } from './lifeOs';
import { useLifeOsStore } from './useLifeOsStore';

export function useRemoveLifeOsRelations(): (uid: string) => void {
  const [, setLifeOs] = useLifeOsStore();
  return useCallback((uid: string) => {
    setLifeOs((current) => withoutRelationsFor(current, uid).data);
  }, [setLifeOs]);
}
