import { FlaskConical } from 'lucide-react';
import { ElectronicsLabView } from '../../ElectronicsWorkbenchViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'electronics-lab', label: 'Build & Test', icon: FlaskConical, order: 40, mode: 'electronics', component: ElectronicsLabView }); } };
export default plugin;
