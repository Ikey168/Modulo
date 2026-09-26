import { ScanSearch } from 'lucide-react';
import { InformationIntakeView } from '../../InformationIntakeView';
import type { PluginModule } from '../types';

const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'information-intake', label: 'Intake', icon: ScanSearch, order: 20, mode: 'research', component: InformationIntakeView }); } };
export default plugin;
