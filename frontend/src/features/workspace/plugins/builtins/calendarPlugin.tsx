/* eslint-disable react-refresh/only-export-components -- lazy plugin module exports a descriptor beside its private React surface */
// Calendar - unlocks Planner's month/year modes with day-planner popovers.
// The child route remains for old deep links, but resolves to the same unified
// Planner surface and is hidden from the Planning hub's granular navigation.
import { CalendarDays } from 'lucide-react';
import { PlannerView } from '../../PlannerView';
import type { PluginModule, WorkspaceViewProps } from '../types';

function CalendarSurface(p: WorkspaceViewProps) {
  return <PlannerView {...p} currentView="calendar" />;
}

const calendarPlugin: PluginModule = {
  activate(ctx) {
    // Lives in the Productivity hub (#369) rather than the Workspace sidebar.
    ctx.addView({ id: 'calendar', label: 'Calendar', icon: CalendarDays, order: 70, component: CalendarSurface, mode: 'productivity', parentViewId: 'planner' });
  },
};

export default calendarPlugin;
