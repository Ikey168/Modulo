import { Dumbbell } from 'lucide-react';
import { WorkoutPlannerView } from '../WorkoutPlannerView';
import type { PluginModule } from '../../../features/workspace/plugins/types';

const plugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'workout-planner', label: 'Workouts', icon: Dumbbell, order: 30, mode: 'life', section: 'Home & Wellbeing', component: WorkoutPlannerView });
  },
};

export default plugin;
