import { LIFE_OS_STORE_KEY, emptyLifeOsData, parseLifeOsData } from './lifeOs';
import { useServerWorkspaceStore } from './useWorkspaceStore';

export function useLifeOsStore() {
  return useServerWorkspaceStore('life-os', 'data', 'modulo.workspace.life-os', emptyLifeOsData(), parseLifeOsData, LIFE_OS_STORE_KEY, 'Life OS');
}
