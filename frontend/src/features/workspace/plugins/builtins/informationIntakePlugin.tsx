import { Newspaper, ScanSearch } from 'lucide-react';
import { InformationIntakeView } from '../../InformationIntakeView';
import { NoesisIntakeView } from './NoesisIntakeView';
import type { PluginModule } from '../types';

const plugin: PluginModule = { activate(ctx) {
  ctx.addView({ id: 'information-intake', label: 'Intake', icon: ScanSearch, order: 20, mode: 'research', component: InformationIntakeView });
  ctx.addView({ id: 'information-intake-noesis', label: 'Noesis Intake', icon: Newspaper,
    order: 21, mode: 'research', component: NoesisIntakeView });
} };
export default plugin;
