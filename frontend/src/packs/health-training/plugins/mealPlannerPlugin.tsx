import { Utensils } from 'lucide-react';
import { MealPlannerView } from '../MealPlannerView';
import type { PluginModule } from '../../../features/workspace/plugins/types';

const plugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'meal-planner', label: 'Meals', icon: Utensils, order: 20, mode: 'life', section: 'Home & Wellbeing', component: MealPlannerView });
  },
};

export default plugin;
