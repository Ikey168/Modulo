import { LayoutDashboard } from 'lucide-react';
import { HobbyDashboardView } from '../../HobbyDashboardView';
import type { PluginModule } from '../types';

const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'hobby-dashboard', label: 'Dashboard', icon: LayoutDashboard, order: 10, mode: 'hobbies', component: HobbyDashboardView }); } };
export default plugin;
