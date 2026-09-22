import { Compass } from 'lucide-react';
import { InformationWorkbenchView } from '../../InformationWorkbenchView';
import type { PluginModule } from '../types';

const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'information-workbench', label: 'Workbench', icon: Compass, order: 30, mode: 'research', component: InformationWorkbenchView }); } };
export default plugin;
