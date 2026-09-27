import { Hammer } from 'lucide-react';
import { HobbyPracticeView } from '../HobbyPracticeView';
import type { PluginModule } from '../../../features/workspace/plugins/types';

const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'hobby-practice', label: 'Practice & Artifacts', icon: Hammer, order: 30, mode: 'hobbies', component: HobbyPracticeView }); } };
export default plugin;
