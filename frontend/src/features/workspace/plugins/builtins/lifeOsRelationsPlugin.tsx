import { Link2 } from 'lucide-react';
import { LifeOsRelationsView } from '../../LifeOsViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'life-os-relations', label: 'Relations', icon: Link2, order: 30, mode: 'life-os', component: LifeOsRelationsView }); } };
export default plugin;
