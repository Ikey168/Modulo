import { LayoutDashboard } from 'lucide-react';
import { MusicDashboardView } from '../../MusicStudioViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'music-dashboard', label: 'Dashboard', icon: LayoutDashboard, order: 10, mode: 'music', component: MusicDashboardView }); } };
export default plugin;
