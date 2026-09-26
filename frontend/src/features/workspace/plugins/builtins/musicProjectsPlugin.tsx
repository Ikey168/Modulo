import { Disc3 } from 'lucide-react';
import { MusicProjectsView } from '../../MusicStudioViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'music-track-lab', label: 'Track Lab', icon: Disc3, order: 20, mode: 'music', component: MusicProjectsView }); } };
export default plugin;
