import { LayoutDashboard } from 'lucide-react';
import { InformationIntakeDashboardView } from '../../InformationIntakeDashboardView';
import type { PluginModule } from '../types';

const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'information-dashboard', label: 'Dashboard', icon: LayoutDashboard, order: 10, mode: 'research', parentViewId: 'research-overview', component: InformationIntakeDashboardView }); } };
export default plugin;
