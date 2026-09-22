import { ArrowDownToLine } from 'lucide-react';
import { LifeOsPortabilityView } from '../../LifeOsViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'life-os-portability', label: 'Portability', icon: ArrowDownToLine, order: 50, mode: 'life-os', component: LifeOsPortabilityView }); } };
export default plugin;
