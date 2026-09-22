import { ArrowDownToLine } from 'lucide-react';
import { ParaMigrationView } from '../../ParaMigrationView';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'para-migration', label: 'Migrate', icon: ArrowDownToLine, order: 49, mode: 'para', component: ParaMigrationView }); } };
export default plugin;
