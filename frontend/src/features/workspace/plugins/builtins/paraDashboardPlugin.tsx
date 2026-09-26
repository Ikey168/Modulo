import { LayoutDashboard } from 'lucide-react';
import { ParaDashboardView } from '../../ParaDashboardView';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'para-dashboard', label: 'Dashboard', icon: LayoutDashboard, order: 40, mode: 'para', component: ParaDashboardView }); } };
export default plugin;
