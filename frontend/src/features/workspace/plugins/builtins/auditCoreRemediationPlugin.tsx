import { GitCompareArrows } from 'lucide-react';
import { AuditCoreRemediationView } from '../../AuditCoreViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'audit-core-remediation', label: 'Remediation', icon: GitCompareArrows, order: 39, mode: 'audit', component: AuditCoreRemediationView }); } };
export default plugin;
