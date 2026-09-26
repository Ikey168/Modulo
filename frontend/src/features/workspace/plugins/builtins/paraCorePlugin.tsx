import { Archive, Box, FolderKanban, Map } from 'lucide-react';
import { ParaArchiveView, ParaAreasView, ParaProjectsView, ParaResourcesView } from '../../ParaCoreViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'para-projects', label: 'Projects', icon: FolderKanban, order: 43, mode: 'para', component: ParaProjectsView }); ctx.addView({ id: 'para-areas', label: 'Areas', icon: Map, order: 44, mode: 'para', component: ParaAreasView }); ctx.addView({ id: 'para-resources', label: 'Resources', icon: Box, order: 46, mode: 'para', component: ParaResourcesView }); ctx.addView({ id: 'para-archive', label: 'Archive', icon: Archive, order: 48, mode: 'para', component: ParaArchiveView }); } };
export default plugin;
