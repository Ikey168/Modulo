import { BookOpenCheck, Boxes, Brain, FileOutput, FlaskConical, GitCompareArrows, LayoutDashboard, RefreshCw, ScanSearch } from 'lucide-react';
import {
  ResearchCreationView,
  ResearchDecisionsView,
  ResearchEvidenceView,
  ResearchIterationView,
  ResearchLearningView,
  ResearchMaintenanceView,
  ResearchProjectsView,
  ResearchSignalsView,
  ResearchWorkflowDashboard,
} from '../../ResearchWorkflowViews';
import type { PluginModule } from '../types';

const plugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'research-overview', label: 'Dashboard', icon: LayoutDashboard, order: 10, mode: 'research', component: ResearchWorkflowDashboard });
    ctx.addView({ id: 'research-signals', label: 'Intake & Signals', icon: ScanSearch, order: 20, mode: 'research', component: ResearchSignalsView });
    ctx.addView({ id: 'research-projects', label: 'Projects & Trails', icon: Boxes, order: 30, mode: 'research', component: ResearchProjectsView });
    ctx.addView({ id: 'research-evidence', label: 'Evidence & Synthesis', icon: BookOpenCheck, order: 40, mode: 'research', component: ResearchEvidenceView });
    ctx.addView({ id: 'research-decisions', label: 'Decisions & Problems', icon: GitCompareArrows, order: 50, mode: 'research', component: ResearchDecisionsView });
    ctx.addView({ id: 'research-creation', label: 'Outputs & Creation', icon: FileOutput, order: 60, mode: 'research', component: ResearchCreationView });
    ctx.addView({ id: 'research-learning', label: 'Learning & Transfer', icon: Brain, order: 70, mode: 'research', component: ResearchLearningView });
    ctx.addView({ id: 'research-iteration', label: 'Experiment & Iteration', icon: FlaskConical, order: 80, mode: 'research', component: ResearchIterationView });
    ctx.addView({ id: 'research-maintenance', label: 'Review & Maintenance', icon: RefreshCw, order: 90, mode: 'research', component: ResearchMaintenanceView });
  },
};

export default plugin;
