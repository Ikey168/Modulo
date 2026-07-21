// Vulnerability knowledge base (#360) — clusters classified findings across
// all engagements, links each class to its writeup note, answers "have we seen
// this before?" in the note panel, and inserts class-writeup templates.
// Depends on the Findings Tracker (its class conventions and fence).
import { useEffect, useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { createCoreAPI } from '@modulo/core';
import { classNoteTemplate, relatedFindings } from '../../vulnKb';
import { SeverityBadge, StatusChip } from '../../FindingCard';
import { VulnKbView } from '../../VulnKbView';
import type { NoteFinding } from '../../findings';
import type { NotePanelProps, PluginModule, WorkspaceViewProps } from '../types';

function KbSurface(p: WorkspaceViewProps) {
  return <VulnKbView {...p} />;
}

// NotePanelProps only carries the note, so the panel reads the rest of the
// vault through @modulo/core — the sanctioned surface for feature-pack code.
function RelatedFindingsPanel({ note }: NotePanelProps) {
  const api = useMemo(() => createCoreAPI(), []);
  const [related, setRelated] = useState<NoteFinding[]>([]);

  useEffect(() => {
    let alive = true;
    api
      .notes()
      .then((notes) => {
        if (alive) setRelated(relatedFindings(notes, note));
      })
      .catch(() => {
        if (alive) setRelated([]);
      });
    return () => {
      alive = false;
    };
  }, [api, note]);

  if (related.length === 0) {
    return (
      <p className="px-0.5 py-1 text-xs text-muted-foreground">
        No related findings — classify findings with <span className="font-mono">class: vuln/&lt;name&gt;</span>.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5 py-1">
      {related.slice(0, 8).map((f, i) => (
        <li key={`${f.noteId}-${f.finding.id || i}`} className="flex items-center gap-1.5 text-xs">
          <SeverityBadge severity={f.finding.severity} className="text-[10px]" />
          <span className="min-w-0 flex-1 truncate" title={`${f.finding.title} — ${f.noteTitle}`}>
            {f.finding.title}
          </span>
          <StatusChip status={f.finding.status} className="text-[10px]" />
        </li>
      ))}
      {related.length > 8 && (
        <li className="text-xxs text-muted-foreground">…and {related.length - 8} more in the Knowledge Base tab.</li>
      )}
    </ul>
  );
}

const vulnKbPlugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'vuln-kb', label: 'Knowledge Base', icon: BookOpen, order: 60, mode: 'audit', component: KbSurface });
    ctx.addNotePanel({ id: 'related-findings', title: 'Related findings', order: 40, component: RelatedFindingsPanel });
    ctx.addEditorAction({
      id: 'insert-vuln-class-note',
      label: 'Insert vulnerability writeup',
      icon: BookOpen,
      run: (c) => c.insertAtCursor(`\n\n${classNoteTemplate()}\n`),
    });
  },
};

export default vulnKbPlugin;
