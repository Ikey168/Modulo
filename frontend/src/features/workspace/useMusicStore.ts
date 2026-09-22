import { MUSIC_STORE_KEY, emptyMusicData, parseMusicData } from './musicStudio';
import { useServerWorkspaceStore } from './useWorkspaceStore';

export function useMusicStore() {
  return useServerWorkspaceStore('music', 'data', 'modulo.workspace.music', emptyMusicData(), parseMusicData, MUSIC_STORE_KEY, 'Music');
}
