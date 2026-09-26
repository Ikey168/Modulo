import { LayoutDashboard } from 'lucide-react';
import { LifeOsDashboardView } from '../../LifeOsViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'life-os-dashboard', label: 'Dashboard', icon: LayoutDashboard, order: 10, mode: 'life-os', component: LifeOsDashboardView }); } };
export default plugin;
