import { HOMELAB_STORE_KEY, emptyHomelabData, parseHomelabData } from './homelab';
import { useServerWorkspaceStore } from './useWorkspaceStore';

export function useHomelabStore() {
  return useServerWorkspaceStore('homelab', 'data', 'modulo.workspace.homelab', emptyHomelabData(), parseHomelabData, HOMELAB_STORE_KEY, 'Homelab');
}
