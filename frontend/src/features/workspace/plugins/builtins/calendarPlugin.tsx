// Calendar - contributes a month/week calendar view of notes by date.
// Installable (not pre-installed); lazy-loaded, so CalendarView only enters the
// bundle once this plugin is installed.
import { CalendarDays } from 'lucide-react';
import { CalendarView } from '../../CalendarView';
import type { PluginModule, WorkspaceViewProps } from '../types';

function CalendarSurface(p: WorkspaceViewProps) {
  return <CalendarView notes={p.data.notes} onOpenNote={p.onOpenNote} />;
}

const calendarPlugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'calendar', label: 'Calendar', icon: CalendarDays, order: 70, component: CalendarSurface });
  },
};

export default calendarPlugin;
