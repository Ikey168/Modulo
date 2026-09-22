/* eslint-disable react-refresh/only-export-components -- lazy plugin module exports a descriptor beside its private React surface */
import { BookOpen } from 'lucide-react';
import { MediaLibraryView } from '../../MediaLibraryView';
import type { PluginModule } from '../types';

function MediaLibrarySurface() {
  return <MediaLibraryView />;
}

const plugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'media-library', label: 'All media', icon: BookOpen, order: 80, mode: 'media', section: 'Library', component: MediaLibrarySurface });
  },
};

export default plugin;
