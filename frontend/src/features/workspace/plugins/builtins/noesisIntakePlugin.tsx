import { Newspaper } from 'lucide-react';
import type { PluginModule } from '../types';
import { NoesisIntakeView } from './NoesisIntakeView';

const noesisIntakePlugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'information-intake', label: 'Information Intake', icon: Newspaper,
      order: 90, component: NoesisIntakeView });
  },
};

export default noesisIntakePlugin;
