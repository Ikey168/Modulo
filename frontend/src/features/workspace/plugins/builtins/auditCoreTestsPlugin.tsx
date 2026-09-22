import { FlaskConical } from 'lucide-react';
import { AuditCoreTestsExploitsView } from '../../AuditCoreViews';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'audit-core-tests', label: 'Tests & Exploits', icon: FlaskConical, order: 36, mode: 'audit', component: AuditCoreTestsExploitsView }); } };
export default plugin;
