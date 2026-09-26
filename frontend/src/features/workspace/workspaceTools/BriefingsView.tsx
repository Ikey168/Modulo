import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { WorkspaceViewProps } from '../plugins/types';
import { usePlugins } from '../plugins/PluginProvider';
import { emptyDecisions, validateDecisions } from './decisions';
import { DECISION_JOURNAL_PLUGIN_ID } from '../foundationTools';
import { dayKey } from '../noteDates';
import { decisionIsDue } from '../learningTools';
import { bodyOf, field, fingerprint, now, object, request, useAction, useToolStore } from './shared';
import { ToolPage } from './ToolPage';

interface BriefingState { since: string; notes: Record<string, string>; plugins: string[] }
const empty: BriefingState = { since: '', notes: {}, plugins: [] };
function validate(value: unknown): BriefingState {
  const root = object(value); object(root.notes);
  if (typeof root.since !== 'string' || !Array.isArray(root.plugins) || root.plugins.some(id => typeof id !== 'string') || Object.values(root.notes as object).some(v => typeof v !== 'string')) throw new Error('Invalid briefing checkpoint.');
  return value as BriefingState;
}
export default function BriefingsView({ data, onOpenNote }: WorkspaceViewProps) {
  const store = useToolStore('workspace-briefings', empty, validate); const action = useAction(); const plugins = usePlugins();
  const [baseline, setBaseline] = useState<{ notes: typeof data.notes; hashes: Record<string, string> }>();
  const hashes = baseline?.notes === data.notes ? baseline.hashes : {}; const [failures, setFailures] = useState<{ id: string; blueprint_name?: string; error_class?: string }[]>([]); const [error, setError] = useState('');
  useEffect(() => { let active = true; void Promise.all(data.notes.map(async note => [String(note.id), await fingerprint([note.title, bodyOf(note), note.tags])])).then(pairs => { if (active) setBaseline({ notes: data.notes, hashes: Object.fromEntries(pairs) }); }).catch(() => { if (active) setError('Note changes could not be calculated.'); }); return () => { active = false; }; }, [data.notes]);
  useEffect(() => { let active = true; setFailures([]); setError(''); void request<{ items: typeof failures }>('/api/workflow-runs?state=FAILED&size=100' + (store.value.since ? `&after=${encodeURIComponent(store.value.since)}` : '')).then(result => { if (active) setFailures(result.items); }).catch(() => { if (active) setError('Workflow failures could not be loaded.'); }); return () => { active = false; }; }, [store.value.since]);
  const changed = data.notes.filter(note => hashes[note.id] && hashes[note.id] !== store.value.notes[note.id]);
  const removed = Object.keys(store.value.notes).filter(id => !data.notes.some(note => String(note.id) === id));
  const today = dayKey(new Date());
  const overdue = data.notes.flatMap(note => bodyOf(note).split('\n').filter(line => /^\s*[-*] \[ \]/.test(line)).flatMap(line => { const date = /(?:due::\s*|📅\s*)(\d{4}-\d{2}-\d{2})/.exec(line)?.[1]; return date && date < today ? [{ note, line, date }] : []; }));
  const installed = [...plugins.installedIds].sort();
  const pluginChanges = [...installed.filter(id => !store.value.plugins.includes(id)).map(id => `Installed: ${plugins.manifest(id)?.name ?? id}`), ...store.value.plugins.filter(id => !installed.includes(id)).map(id => `Removed: ${plugins.manifest(id)?.name ?? id}`)];
  return <ToolPage title="What Changed?" notice={store.notice}>{action.alert}
    <p className="text-sm">{store.value.since ? `Since ${new Date(store.value.since).toLocaleString()}` : 'First briefing — your current workspace becomes the baseline when you mark it read.'}</p>
    <button className={field} disabled={!store.ready || action.busy || data.loading || baseline?.notes !== data.notes || !!error} onClick={() => void action.run(() => store.save({ since: now(), notes: hashes, plugins: installed }))}>Mark briefing read</button>
    <section className="space-y-2"><h2 className="font-medium">Notes ({changed.length})</h2><ul>{changed.map(note => <li key={note.id}><button className="underline" onClick={() => onOpenNote(note.id)}>{store.value.notes[note.id] ? 'Edited' : 'Added'}: {note.title}</button></li>)}</ul>{removed.map(id => <p key={id}>Removed or trashed: note #{id}</p>)}{!changed.length && !removed.length && <p>No note changes.</p>}</section>
    {plugins.isEnabled(DECISION_JOURNAL_PLUGIN_ID) && <DecisionReviews />}
    <section className="space-y-2"><h2 className="font-medium">Overdue checklist items ({overdue.length})</h2>{overdue.map((item, index) => <p key={`${item.note.id}:${index}`}><button className="underline" onClick={() => onOpenNote(item.note.id)}>{item.note.title}: {item.line}</button></p>)}<p className="text-xs text-muted-foreground">Recognizes unchecked note tasks with due:: YYYY-MM-DD or 📅 YYYY-MM-DD.</p></section>
    <section className="space-y-2"><h2 className="font-medium">Failed workflows (up to 100)</h2>{error && <p role="alert">{error}</p>}{failures.map(run => <p key={run.id}><Link className="underline" to={`/app/executions?run=${run.id}`}>{run.blueprint_name ?? run.id} · {run.error_class ?? 'Failed'}</Link></p>)}</section>
    <section className="space-y-2"><h2 className="font-medium">Plugins</h2>{pluginChanges.map(change => <p key={change}>{change}</p>)}</section>
  </ToolPage>;
}

function DecisionReviews() {
  const decisions = useToolStore(DECISION_JOURNAL_PLUGIN_ID, emptyDecisions, validateDecisions);
  const due = decisions.value.records.filter(record => decisionIsDue(record));
  return <section className="space-y-2"><h2 className="font-medium">Decision reviews ({due.length})</h2>{decisions.notice}{due.map(record => <p key={record.id}><Link className="underline" to="/app/decision-journal">{record.title} · {record.date}</Link></p>)}</section>;
}
