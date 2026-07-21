// Planner (#370) — grows the daily-notes idea into a planning surface: today's
// dated journal note with carry-over of yesterday's unfinished items, plus a
// week overview. Productivity hub tab. Implements the `daily-notes` catalog id.
import { CalendarDays } from 'lucide-react';
import { PlannerView } from '../../PlannerView';
import { dailyTemplate, isoDate } from '../../planner';
import type { PluginModule, WorkspaceViewProps } from '../types';

function PlannerSurface(p: WorkspaceViewProps) {
  return <PlannerView {...p} />;
}

const plannerPlugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'planner', label: 'Planner', icon: CalendarDays, order: 60, mode: 'productivity', component: PlannerSurface });
    ctx.addEditorAction({
      id: 'insert-daily-plan',
      label: 'Insert daily plan',
      icon: CalendarDays,
      run: (c) => c.insertAtCursor(`\n\n${dailyTemplate(isoDate(new Date()))}\n`),
    });
  },
};

export default plannerPlugin;
