import { WARDROBE_STORE_KEY, emptyWardrobeData, parseWardrobeData } from './wardrobe';
import { useServerWorkspaceStore } from './useWorkspaceStore';

export function useWardrobeStore() {
  return useServerWorkspaceStore('wardrobe', 'data', 'modulo.workspace.wardrobe', emptyWardrobeData(), parseWardrobeData, WARDROBE_STORE_KEY, 'Wardrobe');
}
