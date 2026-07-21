// Zeiterfassung (#365) — billable time tracking per engagement with the
// billing handoff into ```invoice line rows. Business hub tab plus a note
// panel showing time logged against the current note's engagement.
import { Timer } from 'lucide-react';
import { TimeTrackingView } from '../../TimeTrackingView';
import { formatMinutes, readEntries } from '../../timeTracking';
import { formatEur } from '../../invoicing';
import { ENGAGEMENT_TAG_PREFIX } from '../../pipeline';
import type { NotePanelProps, PluginModule, WorkspaceViewProps } from '../types';

function TimeSurface(p: WorkspaceViewProps) {
  return <TimeTrackingView {...p} />;
}

function TimePanel({ note }: NotePanelProps) {
  const engagements = note.tags
    .filter((t) => t.name.startsWith(ENGAGEMENT_TAG_PREFIX))
    .map((t) => t.name.slice(ENGAGEMENT_TAG_PREFIX.length));
  if (engagements.length === 0) {
    return <p className="px-0.5 py-1 text-xs text-muted-foreground">Not an engagement note.</p>;
  }
  const entries = readEntries().filter((e) => engagements.includes(e.engagement));
  const minutes = entries.reduce((n, e) => n + e.minutes, 0);
  const unbilled = entries
    .filter((e) => e.billable && !e.billed)
    .reduce((n, e) => n + (e.minutes / 60) * e.rateEur, 0);
  return (
    <div className="flex flex-col gap-0.5 py-1 text-xs">
      <span>
        {formatMinutes(minutes)} logged · {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
      </span>
      {unbilled > 0 && <span className="text-muted-foreground">{formatEur(Math.round(unbilled * 100) / 100)} unbilled</span>}
    </div>
  );
}

const zeiterfassungPlugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'time', label: 'Time', icon: Timer, order: 45, mode: 'business', component: TimeSurface });
    ctx.addNotePanel({ id: 'time-logged', title: 'Time logged', order: 50, component: TimePanel });
  },
};

export default zeiterfassungPlugin;
