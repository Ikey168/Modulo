import { FileCheck2 } from 'lucide-react';
import { AuditCoreReportView } from '../../AuditCoreViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'audit-core-report', label: 'Generated Report', icon: FileCheck2, order: 38, mode: 'audit', component: AuditCoreReportView }); } };
export default plugin;
