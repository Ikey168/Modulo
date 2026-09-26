import { PARA_STORE_KEY, createEmptyPara, parsePara } from './para';
import { useServerWorkspaceStore } from './useWorkspaceStore';

/** The authenticated workspace record shared by every PARA/Desktop surface. */
export const PARA_WORKSPACE_NAMESPACE = 'para';
export const PARA_WORKSPACE_KEY = 'data';
export const PARA_WORKSPACE_SCHEMA = 'modulo.workspace.para';

export function useParaStore() {
  // The legacy key is read only for an explicit first-login import. Reads and
  // writes after that go through the authenticated workspace plugin-state API.
  return useServerWorkspaceStore(
    PARA_WORKSPACE_NAMESPACE,
    PARA_WORKSPACE_KEY,
    PARA_WORKSPACE_SCHEMA,
    createEmptyPara(),
    parsePara,
    PARA_STORE_KEY,
    'PARA',
  );
}
