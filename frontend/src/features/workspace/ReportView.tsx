// Audit report generator view (#359): pick an engagement, preview the compiled
// report, then create it as a note, export it (print → PDF, or download the
// markdown), and anchor the report note via the existing on-chain flow. A tab
// in the Audit hub.
import { useMemo, useState } from 'react';
import { Anchor, FileDown, FilePlus2, Printer, ScrollText } from 'lucide-react';
import { Button, EmptyState, useToast } from '@/ui';
import type { WorkspaceViewProps } from './plugins/types';
import { buildReport, engagementsIn, reportDocument } from './auditReport';

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function printReport(markdown: string, title: string) {
  const win = window.open('', '_blank', 'noopener,width=800,height=900');
  if (!win) return;
  win.document.write(reportDocument(markdown, title));
  win.document.close();
  win.focus();
  win.print();
}

export function ReportView({ data, onOpenNote }: WorkspaceViewProps) {
  const { toast } = useToast();
  const engagements = useMemo(() => engagementsIn(data.notes), [data.notes]);
  const [engagement, setEngagement] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = engagement ?? engagements[0] ?? null;

  const report = useMemo(
    () => (selected ? buildReport({ engagement: selected, notes: data.notes, date: new Date() }) : null),
    [selected, data.notes],
  );

  // A previously generated report note for this engagement, to anchor/open.
  const existingReport = useMemo(
    () => (selected ? data.notes.find((n) => n.title.startsWith(`Audit report — ${selected}`)) : undefined),
    [data.notes, selected],
  );

  const createReportNote = async () => {
    if (!report) return;
    setBusy(true);
    try {
      const created = await data.createNote(report.title, report.markdown);
      if (created) {
        toast({ title: 'Report note created', description: report.countsLine });
        onOpenNote(created.id);
      }
    } finally {
      setBusy(false);
    }
  };

  const anchorExisting = async () => {
    if (!existingReport) return;
    setBusy(true);
    try {
      await data.anchorNote(existingReport.id);
      toast({ title: 'Anchor requested', description: 'The report hash is being anchored on-chain.' });
    } finally {
      setBusy(false);
    }
  };

  if (engagements.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <EmptyState
          icon={<ScrollText className="size-5" />}
          title="No engagements found"
          description="Tag notes with engagement/<client>-<project>; reports compile that engagement's scope and findings."
        />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-sm font-semibold">Report</h2>
          {engagements.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEngagement(e)}
              aria-pressed={e === selected}
              className={
                e === selected
                  ? 'rounded-full border border-primary bg-primary/10 px-2.5 py-0.5 text-xs text-primary'
                  : 'rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground'
              }
            >
              {e}
            </button>
          ))}
        </div>
        {report && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={busy} onClick={() => void createReportNote()}>
              <FilePlus2 className="size-4" aria-hidden="true" />
              Create report note
            </Button>
            <Button size="sm" variant="outline" onClick={() => printReport(report.markdown, report.title)}>
              <Printer className="size-4" aria-hidden="true" />
              Export PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadText(`${report.title.replace(/[^\w-]+/g, '_')}.md`, report.markdown)}
            >
              <FileDown className="size-4" aria-hidden="true" />
              Download .md
            </Button>
            {existingReport && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void anchorExisting()}>
                <Anchor className="size-4" aria-hidden="true" />
                {existingReport.isOnBlockchain ? 'Re-anchor report note' : 'Anchor report note'}
              </Button>
            )}
            <span className="text-xs text-muted-foreground">{report.countsLine}</span>
          </div>
        )}
      </div>
      {report && (
        <pre className="flex-1 overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-xs leading-relaxed text-foreground/90">
          {report.markdown}
        </pre>
      )}
    </div>
  );
}
