import { Boxes, BookOpenCheck, GitCompareArrows, Wrench, FileOutput, ListChecks, Brain, FlaskConical, RefreshCw } from 'lucide-react';

// Installable tools, not mode dashboards. View IDs retain existing deep links.
export const RESEARCH_ROLES = [
  { id: 'research-projects-trails', viewId: 'research-projects', name: 'Research Projects & Trails', stage: 'Exploration', icon: Boxes, component: 'ResearchProjectsView', desc: 'Bound research topics and curiosity trails with scope, stopping rules, timeboxes, and provenance.' },
  { id: 'evidence-synthesis', viewId: 'research-evidence', name: 'Evidence Synthesis', stage: 'Deep Research', icon: BookOpenCheck, component: 'ResearchEvidenceView', desc: 'Build briefs from sources and claims; record what is known, uncertain, and unresolved.' },
  { id: 'decision-cases', viewId: 'research-decisions', name: 'Decision Cases', stage: 'Decision Support', icon: GitCompareArrows, component: 'ResearchDecisionsView', desc: 'Compare options and document evidence, criteria, rationale, and revisit triggers.' },
  { id: 'problem-solving', viewId: 'research-problems', name: 'Problem Solver', stage: 'Problem-Solving', icon: Wrench, component: 'ResearchProblemsView', desc: 'Track blockers, hypotheses, tested fixes, verification, and reusable solutions.' },
  { id: 'creation-briefs', viewId: 'research-creation', name: 'Creation Briefs', stage: 'Creation', icon: FileOutput, component: 'ResearchCreationView', desc: 'Define purpose, audience, acceptance criteria, feedback, and shipped outputs.' },
  { id: 'procedure-design', viewId: 'research-externalization', name: 'Procedure Design', stage: 'Externalization', icon: ListChecks, component: 'ResearchExternalizationView', desc: 'Encode reusable knowledge as validated playbooks, templates, and configurations.' },
  { id: 'practice-plans', viewId: 'research-learning', name: 'Practice Plans', stage: 'Internalization', icon: Brain, component: 'ResearchLearningView', desc: 'Define retrieval prompts, deliberate practice, demonstration tests, and review dates.' },
  { id: 'knowledge-experiments', viewId: 'research-iteration', name: 'Experiments', stage: 'Iteration', icon: FlaskConical, component: 'ResearchIterationView', desc: 'Test changes against baselines and metrics; capture observations and next revisions.' },
  { id: 'knowledge-maintenance', viewId: 'research-maintenance', name: 'Knowledge Maintenance', stage: 'Maintenance', icon: RefreshCw, component: 'ResearchMaintenanceView', desc: 'Review stale outputs, broken links, duplicates, and orphaned records.' },
] as const;
export const RESEARCH_ROLE_IDS = RESEARCH_ROLES.map(role => role.id);
