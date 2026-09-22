import { useRef, useState } from 'react';
import { ArrowDownToLine, Download, FileSearch, Upload } from 'lucide-react';
import { Button, Input, useToast } from '@/ui';
import {
  EmptyPanel,
  HealthLine,
  HealthList,
  Metric,
  MetricRow,
  Panel,
  ViewShell,
} from './viewkit';
import { isoDay, mergePara, parsePara } from './para';
import { previewNotionFiles, type NotionImportPreview } from './paraMigration';
import { useParaStore } from './useParaStore';
import type { WorkspaceViewProps } from './plugins/types';

export function ParaMigrationView({ data: workspace }: WorkspaceViewProps) {
  const [data, persist] = useParaStore();
  const [preview, setPreview] = useState<NotionImportPreview | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [importing, setImporting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const busy = inspecting || importing;

  const inspect = async (files: FileList | null) => {
    if (!files?.length) return;
    setInspecting(true);
    try {
      setPreview(await previewNotionFiles([...files]));
    } catch {
      setPreview(null);
      toast({
        title: 'Could not read export',
        description: 'Unzip the Notion export and select its CSV, Markdown, or Modulo JSON files.',
        variant: 'destructive',
      });
    } finally {
      setInspecting(false);
    }
  };

  const runImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const incoming = parsePara(preview.data);
      let notes = 0;
      for (const markdown of preview.markdown) {
        const existing = data.resources.find((item) => item.sourceId === markdown.sourceId && item.noteId);
        if (existing) continue;
        const created = await workspace.createNote(markdown.title, markdown.content);
        const resource = incoming.resources.find((item) => item.sourceId === markdown.sourceId);
        if (created && resource) {
          resource.noteId = created.id;
          resource.content = undefined;
          notes += 1;
        }
      }
      persist(mergePara(data, incoming));
      toast({
        title: 'Notion export imported',
        description: `${summary(incoming)}${notes ? ` · ${notes} Markdown notes created` : ''}`,
      });
    } finally {
      setImporting(false);
    }
  };

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `modulo-para-${isoDay()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ViewShell
      title="Notion PARA Migrator"
      icon={FileSearch}
      subtitle="Dry-run first; imports merge by stable Notion source ID."
      actions={
        <>
          <Input
            ref={input}
            type="file"
            multiple
            accept=".csv,.md,.json,text/csv,text/markdown,application/json"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(event) => void inspect(event.target.files)}
          />
          <Button size="sm" variant="outline" loading={inspecting} disabled={busy} onClick={() => input.current?.click()}>
            <Upload className="size-4" aria-hidden="true" />
            Select export files
          </Button>
          <Button size="sm" variant="outline" onClick={exportBackup}>
            <Download className="size-4" aria-hidden="true" />
            Backup
          </Button>
        </>
      }
    >
      {!preview ? (
        <EmptyPanel
          icon={FileSearch}
          size="page"
          title="Select an unzipped Notion export"
          description="Choose CSV databases and Markdown pages together. Nothing is written until you approve the preview."
          action={
            <Button size="sm" loading={inspecting} disabled={busy} onClick={() => input.current?.click()}>
              <Upload className="size-4" aria-hidden="true" />
              Select export files
            </Button>
          }
        />
      ) : (
        <div className="max-w-3xl space-y-4">
          <Panel
            title="Dry-run preview"
            icon={FileSearch}
            description={`${preview.files} files inspected · ${preview.markdown.length} Markdown pages`}
          >
            <MetricRow className="lg:grid-cols-3">
              <Metric label="Projects" value={preview.data.projects.length} />
              <Metric label="Areas" value={preview.data.areas.length} />
              <Metric label="Resources" value={preview.data.resources.length} />
              <Metric label="Tasks" value={preview.data.tasks.length} />
              <Metric label="Arcs" value={preview.data.goals.length} />
              <Metric label="Reviews" value={preview.data.reviews.length} />
            </MetricRow>
          </Panel>

          {preview.warnings.length > 0 && (
            <Panel
              title={`${preview.warnings.length} warning${preview.warnings.length === 1 ? '' : 's'}`}
              description="These rows import with fallbacks. Nothing is lost, but check them afterwards."
            >
              <HealthList>
                {preview.warnings.map((warning) => (
                  <HealthLine key={warning} okay={false}>
                    {warning}
                  </HealthLine>
                ))}
              </HealthList>
            </Panel>
          )}

          <Button size="sm" loading={importing} disabled={busy} onClick={() => void runImport()}>
            <ArrowDownToLine className="size-4" aria-hidden="true" />
            {importing ? 'Importing…' : 'Import and merge'}
          </Button>
        </div>
      )}
    </ViewShell>
  );
}

function summary(data: NotionImportPreview['data']): string {
  return `${data.projects.length} projects, ${data.areas.length} areas, ${data.resources.length} resources, ${data.tasks.length} tasks, ${data.goals.length} arcs, ${data.reviews.length} reviews`;
}
