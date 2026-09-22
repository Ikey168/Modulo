import { Network } from 'lucide-react';
import { AuditCoreScopeArchitectureView } from '../../AuditCoreViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'audit-core-scope', label: 'Scope', icon: Network, order: 30, mode: 'audit', component: AuditCoreScopeArchitectureView }); } };
export default plugin;
