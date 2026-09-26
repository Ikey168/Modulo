import { TTRPG_STORE_KEY, emptyTtrpgData, parseTtrpgData } from './ttrpg';
import { useServerWorkspaceStore } from './useWorkspaceStore';

export function useTtrpgStore() {
  return useServerWorkspaceStore('ttrpg', 'data', 'modulo.workspace.ttrpg', emptyTtrpgData(), parseTtrpgData, TTRPG_STORE_KEY, 'TTRPG');
}
