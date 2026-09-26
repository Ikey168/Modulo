import { Target } from 'lucide-react';
import { ParaGoalsView } from '../../ParaGoalsView';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'para-goals', label: 'Arcs', icon: Target, order: 45, mode: 'para', component: ParaGoalsView }); } };
export default plugin;
