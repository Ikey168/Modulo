import { ROUTINES_STORE_KEY, emptyRoutines, parseRoutines } from './routines';
import { useServerWorkspaceStore } from './useWorkspaceStore';

export function useRoutinesStore() {
  return useServerWorkspaceStore('routines', 'data', 'modulo.workspace.routines', emptyRoutines(), parseRoutines, ROUTINES_STORE_KEY, 'Routines & habits');
}
