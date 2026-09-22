import { Inbox } from 'lucide-react';
import { ParaCaptureView } from '../../ParaCaptureView';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'para-capture', label: 'Capture', icon: Inbox, order: 41, mode: 'para', component: ParaCaptureView }); } };
export default plugin;
