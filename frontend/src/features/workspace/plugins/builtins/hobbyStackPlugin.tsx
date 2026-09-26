import { Layers3 } from 'lucide-react';
import { HobbyStackView } from '../../HobbyStackView';
import type { PluginModule } from '../types';

const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'hobby-stack', label: 'Stack', icon: Layers3, order: 20, mode: 'hobbies', component: HobbyStackView }); } };
export default plugin;
