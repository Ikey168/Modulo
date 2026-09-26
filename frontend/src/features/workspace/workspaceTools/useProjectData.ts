import { useToolStore } from './shared';
import { emptyDecisions, validateDecisions } from './decisions';
import { emptyRunbooks, validateRunbooks } from './runbooks';
import { emptyProjects, PROJECTS_ID, validateProjects } from './projects';

export function useProjectData() {
  const projects = useToolStore(PROJECTS_ID, emptyProjects, validateProjects);
  const decisions = useToolStore('decision-journal', emptyDecisions, validateDecisions);
  const runbooks = useToolStore('executable-runbooks', emptyRunbooks, validateRunbooks);
  return { projects, decisions, runbooks, ready: projects.ready && decisions.ready && runbooks.ready };
}
export type ProjectData = ReturnType<typeof useProjectData>;
