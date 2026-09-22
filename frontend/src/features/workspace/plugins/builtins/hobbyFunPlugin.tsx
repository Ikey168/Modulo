import { PartyPopper } from 'lucide-react';
import { HobbyFunView } from '../../HobbyFunView';
import type { PluginModule } from '../types';

const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'hobby-fun', label: 'Fun Menu', icon: PartyPopper, order: 40, mode: 'hobbies', component: HobbyFunView }); } };
export default plugin;
