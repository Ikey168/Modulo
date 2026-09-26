import { Repeat2 } from 'lucide-react';
import { RoutinesHabitsView } from '../../RoutinesHabitsView';
import type { PluginModule } from '../types';

const plugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'routines-habits', label: 'Routines', icon: Repeat2, order: 10, mode: 'life', section: 'Home & Wellbeing', component: RoutinesHabitsView });
  },
};

export default plugin;
