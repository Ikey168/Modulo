import { PARA_STORE_KEY, createEmptyPara, parsePara } from './para';
import { useServerWorkspaceStore } from './useWorkspaceStore';

export function useParaStore() {
  return useServerWorkspaceStore('para', 'data', 'modulo.workspace.para', createEmptyPara(), parsePara, PARA_STORE_KEY, 'PARA');
}
