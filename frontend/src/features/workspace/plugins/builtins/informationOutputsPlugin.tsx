import { FileText } from 'lucide-react';
import { InformationOutputsView } from '../../InformationOutputsView';
import type { PluginModule } from '../types';

const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'information-outputs', label: 'Outputs', icon: FileText, order: 40, mode: 'research', component: InformationOutputsView }); } };
export default plugin;
