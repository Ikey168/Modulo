import { ScanSearch } from 'lucide-react';
import { LifeOsExplorerView } from '../../LifeOsViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'life-os-explorer', label: 'Explorer', icon: ScanSearch, order: 20, mode: 'life-os', component: LifeOsExplorerView }); } };
export default plugin;
