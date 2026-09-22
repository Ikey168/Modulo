import { ListChecks } from 'lucide-react';
import { AuditCoreFindingsView } from '../../AuditCoreViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'audit-core-findings', label: 'Output Findings', icon: ListChecks, order: 34, mode: 'audit', component: AuditCoreFindingsView }); } };
export default plugin;
