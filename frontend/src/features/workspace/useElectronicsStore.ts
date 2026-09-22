import { ELECTRONICS_STORE_KEY, emptyElectronicsData, parseElectronicsData } from './electronicsWorkbench';
import { useServerWorkspaceStore } from './useWorkspaceStore';

export function useElectronicsStore() {
  return useServerWorkspaceStore('electronics', 'data', 'modulo.workspace.electronics', emptyElectronicsData(), parseElectronicsData, ELECTRONICS_STORE_KEY, 'Electronics');
}
