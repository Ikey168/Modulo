import { useEffect, useState } from 'react';
import { FileArchive } from 'lucide-react';
import { PaperlessRecordsView } from '../../PaperlessRecordsView';
import { paperlessDocumentUrl, paperlessReferences } from '../../paperless';
import { usePlugins } from '../PluginProvider';
import type { NotePanelProps, PluginModule } from '../types';

function PaperlessReferences({ note }: NotePanelProps) {
  const plugins = usePlugins();
  const [baseUrl, setBaseUrl] = useState('https://paperless.zt');
  useEffect(() => {
    let live = true; let stop: (() => void) | undefined;
    void plugins.state('paperless').then(state => {
      const update = () => {
        const value = state.get('settings')?.value;
        if (live && typeof value === 'object' && value !== null && !Array.isArray(value)
          && typeof value.baseUrl === 'string') setBaseUrl(value.baseUrl);
      };
      stop = state.watch(update); update(); void state.refresh('settings').then(update).catch(() => {});
    }).catch(() => {});
    return () => { live = false; stop?.(); };
  }, [plugins.stateSessionKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const refs = paperlessReferences(String(note.markdownContent ?? note.content ?? ''));
  if (!refs.length) return <p className="py-1 text-xs text-muted-foreground">No paperless:&lt;id&gt; references in this note.</p>;
  return <div className="flex flex-wrap gap-1.5 py-1">{refs.map(id => <a key={id} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted" href={paperlessDocumentUrl(baseUrl, id)} target="_blank" rel="noreferrer">paperless:{id}</a>)}</div>;
}

const plugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'paperless-records', label: 'Records', icon: FileArchive, order: 34, mode: 'life-home', component: PaperlessRecordsView });
    ctx.addNotePanel({ id: 'paperless-references', title: 'Paperless records', order: 65, component: PaperlessReferences });
  },
};

export default plugin;
