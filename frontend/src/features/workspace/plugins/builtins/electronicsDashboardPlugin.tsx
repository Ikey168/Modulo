import { LayoutDashboard } from 'lucide-react';
import { ElectronicsDashboardView } from '../../ElectronicsWorkbenchViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'electronics-dashboard', label: 'Dashboard', icon: LayoutDashboard, order: 10, mode: 'electronics', component: ElectronicsDashboardView }); } };
export default plugin;
