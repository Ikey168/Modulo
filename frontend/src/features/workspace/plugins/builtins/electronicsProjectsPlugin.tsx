import { CircuitBoard } from 'lucide-react';
import { ElectronicsProjectsView } from '../../ElectronicsWorkbenchViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'electronics-projects', label: 'Projects', icon: CircuitBoard, order: 20, mode: 'electronics', component: ElectronicsProjectsView }); } };
export default plugin;
