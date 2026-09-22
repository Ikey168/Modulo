import { RefreshCw } from 'lucide-react';
import { LifeOsReviewView } from '../../LifeOsViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'life-os-review', label: 'Weekly Review', icon: RefreshCw, order: 40, mode: 'life-os', component: LifeOsReviewView }); } };
export default plugin;
