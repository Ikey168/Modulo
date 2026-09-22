import { INFORMATION_INTAKE_STORE_KEY, emptyInformationIntake, parseInformationIntake } from './informationIntake';
import { useServerWorkspaceStore } from './useWorkspaceStore';

export function useInformationIntakeStore() {
  return useServerWorkspaceStore('information', 'data', 'modulo.workspace.information', emptyInformationIntake(), parseInformationIntake, INFORMATION_INTAKE_STORE_KEY, 'Information intake');
}
