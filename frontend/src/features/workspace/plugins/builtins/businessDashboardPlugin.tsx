import { BriefcaseBusiness } from 'lucide-react'; import { BusinessDashboardView } from '../../BusinessAdminViews'; import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'business-dashboard', label: 'Dashboard', icon: BriefcaseBusiness, order: 10, mode: 'business', component: BusinessDashboardView }); } }; export default plugin;
