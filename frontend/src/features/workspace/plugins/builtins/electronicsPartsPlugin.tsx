import { Cpu } from 'lucide-react';
import { ElectronicsPartsView } from '../../ElectronicsWorkbenchViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'electronics-parts', label: 'Parts & BOM', icon: Cpu, order: 30, mode: 'electronics', component: ElectronicsPartsView }); } };
export default plugin;
