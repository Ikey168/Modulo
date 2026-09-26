import { LibraryBig } from 'lucide-react';
import { MusicAssetsView } from '../../MusicStudioViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'music-library', label: 'Library & Studio', icon: LibraryBig, order: 40, mode: 'music', component: MusicAssetsView }); } };
export default plugin;
