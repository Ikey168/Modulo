// Findings Tracker (#358) — contributes the ```finding fence renderer, the
// cross-engagement Findings dashboard (a tab in the Audit hub), and an editor
// action that inserts a finding template. Depends on Markdown Notes.
import { Bug } from 'lucide-react';
import { FindingCard } from '../../FindingCard';
import { FindingsView } from '../../FindingsView';
import type { NoteFenceProps, PluginModule, WorkspaceViewProps } from '../types';

function FindingFence({ source }: NoteFenceProps) {
  return <FindingCard source={source} />;
}

function FindingsSurface(p: WorkspaceViewProps) {
  return <FindingsView {...p} />;
}

function insertTemplate(insertAtCursor: (text: string) => void) {
  insertAtCursor(
    `\n\n\`\`\`finding\nid: F-01\ntitle: Short finding title\nseverity: medium\nstatus: open\ncontract: Example.sol\nlocation: withdraw() L42-57\nclass: vuln/reentrancy\n\nDescription of the issue and its impact.\n\nRecommendation: how to fix it.\n\`\`\`\n\n`,
  );
}

const findingsPlugin: PluginModule = {
  activate(ctx) {
    ctx.addNoteFence({ language: 'finding', component: FindingFence });
    ctx.addView({ id: 'findings', label: 'Findings', icon: Bug, order: 40, mode: 'audit', component: FindingsSurface });
    ctx.addEditorAction({
      id: 'insert-finding',
      label: 'Insert finding',
      icon: Bug,
      run: (c) => insertTemplate(c.insertAtCursor),
    });
  },
};

export default findingsPlugin;
