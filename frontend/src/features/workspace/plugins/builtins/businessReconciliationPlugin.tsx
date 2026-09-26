import { Receipt } from 'lucide-react'; import { BusinessReconciliationView } from '../../BusinessAdminViews'; import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'business-reconciliation', label: 'Reconciliation', icon: Receipt, order: 30, mode: 'business', component: BusinessReconciliationView }); } }; export default plugin;
