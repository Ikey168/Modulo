import { FileSignature } from 'lucide-react'; import { BusinessContractsView } from '../../BusinessAdminViews'; import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'business-contracts', label: 'Contracts', icon: FileSignature, order: 25, mode: 'business', component: BusinessContractsView }); } }; export default plugin;
