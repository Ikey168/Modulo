import { LayoutDashboard } from 'lucide-react';
import { EducationDashboardView } from '../../EducationDashboardView';
import type { PluginModule } from '../types';

const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'education-dashboard', label: 'Dashboard', icon: LayoutDashboard, order: 39, mode: 'education', component: EducationDashboardView }); } };
export default plugin;
