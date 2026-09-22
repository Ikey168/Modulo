import { BUSINESS_ADMIN_STORE_KEY, emptyBusinessAdmin, parseBusinessAdmin } from './businessAdmin';
import { useServerWorkspaceStore } from './useWorkspaceStore';

export function useBusinessAdminStore() {
  return useServerWorkspaceStore('business', 'data', 'modulo.workspace.business', emptyBusinessAdmin(), parseBusinessAdmin, BUSINESS_ADMIN_STORE_KEY, 'Business');
}
