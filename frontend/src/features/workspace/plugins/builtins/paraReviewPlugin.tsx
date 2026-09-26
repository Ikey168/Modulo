import { RefreshCw } from 'lucide-react';
import { ParaReviewView } from '../../ParaReviewView';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'para-review', label: 'Review', icon: RefreshCw, order: 47, mode: 'para', component: ParaReviewView }); } };
export default plugin;
