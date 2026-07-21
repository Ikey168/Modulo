// Audit report generator (#359) — compiles an engagement's scope notes and
// findings into a report note, exports it (print→PDF / markdown download), and
// anchors the report note through the existing on-chain flow. Audit hub tab.
// Depends on the Findings Tracker for the finding conventions it compiles.
import { ScrollText } from 'lucide-react';
import { ReportView } from '../../ReportView';
import type { PluginModule, WorkspaceViewProps } from '../types';

function ReportSurface(p: WorkspaceViewProps) {
  return <ReportView {...p} />;
}

const reportsPlugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'audit-reports', label: 'Reports', icon: ScrollText, order: 55, mode: 'audit', component: ReportSurface });
  },
};

export default reportsPlugin;
