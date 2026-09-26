import { Landmark } from 'lucide-react'; import { BusinessObligationsView } from '../../BusinessAdminViews'; import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'business-obligations', label: 'Obligations', icon: Landmark, order: 35, mode: 'business', component: BusinessObligationsView }); } }; export default plugin;
