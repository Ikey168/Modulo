import { Mail } from 'lucide-react'; import { BusinessOperationsView } from '../../BusinessAdminViews'; import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'business-operations', label: 'Operations', icon: Mail, order: 38, mode: 'business', component: BusinessOperationsView }); } }; export default plugin;
