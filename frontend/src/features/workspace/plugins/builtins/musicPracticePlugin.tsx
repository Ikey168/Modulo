import { Guitar } from 'lucide-react';
import { MusicPracticeView } from '../../MusicStudioViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'music-practice', label: 'Practice', icon: Guitar, order: 30, mode: 'music', component: MusicPracticeView }); } };
export default plugin;
