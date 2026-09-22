import { EDUCATION_STORE_KEY, emptyEducation, parseEducation } from './education';
import { useServerWorkspaceStore } from './useWorkspaceStore';

export function useEducationStore() {
  return useServerWorkspaceStore('education', 'data', 'modulo.workspace.education', emptyEducation(), parseEducation, EDUCATION_STORE_KEY, 'Education');
}
