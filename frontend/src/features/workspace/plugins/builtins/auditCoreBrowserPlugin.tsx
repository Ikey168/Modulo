import { FolderOpen } from 'lucide-react';
import { AuditCoreBrowserView } from '../../AuditCoreViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'audit-core-browser', label: 'Core Browser', icon: FolderOpen, order: 10, mode: 'audit', component: AuditCoreBrowserView }); } };
export default plugin;
