// Audit methodology checklists (#362) — a note-details panel showing checkbox
// progress per section, plus editor actions inserting a methodology template
// per contract type. Progress is parsed from the note body; there is no extra
// storage. Depends on Markdown Notes.
import { ListChecks } from 'lucide-react';
import { Progress } from '@/ui';
import { CHECKLIST_TEMPLATES, parseChecklistProgress } from '../../checklists';
import type { NotePanelProps, PluginModule } from '../types';

function ChecklistPanel({ note }: NotePanelProps) {
  const progress = parseChecklistProgress(note.markdownContent ?? note.content ?? '');
  if (progress.total === 0) {
    return (
      <p className="px-0.5 py-1 text-xs text-muted-foreground">
        No checklist yet — insert one from the editor toolbar.
      </p>
    );
  }
  const pct = Math.round((progress.done / progress.total) * 100);
  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">
          {progress.done}/{progress.total} done
        </span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <Progress value={pct} aria-label="Checklist progress" />
      <ul className="mt-1 flex flex-col gap-1.5">
        {progress.sections.map((s, i) => (
          <li key={`${s.title}-${i}`} className="text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-muted-foreground" title={s.title}>
                {s.title}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {s.done}/{s.total}
              </span>
            </div>
            <Progress value={s.total === 0 ? 0 : Math.round((s.done / s.total) * 100)} className="mt-0.5 h-1" />
          </li>
        ))}
      </ul>
    </div>
  );
}

const checklistsPlugin: PluginModule = {
  activate(ctx) {
    ctx.addNotePanel({ id: 'audit-checklist', title: 'Audit checklist', order: 20, component: ChecklistPanel });
    for (const template of CHECKLIST_TEMPLATES) {
      ctx.addEditorAction({
        id: `insert-checklist-${template.key}`,
        label: `Checklist: ${template.label}`,
        icon: ListChecks,
        run: (c) => c.insertAtCursor(`\n\n${template.markdown}\n`),
      });
    }
  },
};

export default checklistsPlugin;
