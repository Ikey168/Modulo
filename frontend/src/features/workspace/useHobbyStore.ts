import { HOBBY_STORE_KEY, emptyHobbyData, parseHobbyData } from './hobbies';
import { useServerWorkspaceStore } from './useWorkspaceStore';

export function useHobbyStore() {
  return useServerWorkspaceStore('hobbies', 'data', 'modulo.workspace.hobbies', emptyHobbyData(), parseHobbyData, HOBBY_STORE_KEY, 'Hobbies');
}
