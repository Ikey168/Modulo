import { ShieldAlert } from 'lucide-react';
import { AuditCoreThreatModelView } from '../../AuditCoreViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'audit-core-threats', label: 'Threats', icon: ShieldAlert, order: 32, mode: 'audit', component: AuditCoreThreatModelView }); } };
export default plugin;
