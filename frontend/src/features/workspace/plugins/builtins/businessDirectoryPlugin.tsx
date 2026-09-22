import { Building2 } from 'lucide-react'; import { BusinessDirectoryView } from '../../BusinessAdminViews'; import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'business-directory', label: 'Directory', icon: Building2, order: 20, mode: 'business', component: BusinessDirectoryView }); } }; export default plugin;
