import { Gauge } from 'lucide-react';
import { AuditCoreOverviewView } from '../../AuditCoreViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'audit-core-overview', label: 'Phases', icon: Gauge, order: 20, mode: 'audit', component: AuditCoreOverviewView }); } };
export default plugin;
