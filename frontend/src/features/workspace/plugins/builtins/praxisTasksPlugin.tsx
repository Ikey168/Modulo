import { Workflow } from 'lucide-react';
import { PraxisTasksView } from '../../../praxis/PraxisTasksView';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'praxis-tasks', label: 'Praxis Tasks', icon: Workflow, order: 50, mode: 'tools', section: 'Automation', component: PraxisTasksView }); } };
export default plugin;
