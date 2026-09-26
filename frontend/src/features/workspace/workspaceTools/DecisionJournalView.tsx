import { readLegacyValue } from '../../../services/legacy/browserLegacyStorage';
import { useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { WorkspaceViewProps } from '../plugins/types';
import { lifeStoreKey, type LifeRecord } from '../lifeStore';
import { decisionIsDue, newLearningRecord, reviewDecision, validateDecision } from '../learningTools';
import { ToolPage } from './ToolPage';
import { download, field, useAction, useToolStore } from './shared';
import { emptyDecisions, validateDecisions } from './decisions';

const id = 'decision-journal';
const fields = [['choice', 'Chosen option'], ['alternatives', 'Alternatives'], ['evidence', 'Supporting evidence'], ['assumptions', 'Assumptions'], ['expectedOutcome', 'Expected outcome']] as const;
export default function DecisionJournalView({ data, onOpenNote }: WorkspaceViewProps) {
  const [params] = useSearchParams();
  const store = useToolStore(id, emptyDecisions, validateDecisions); const action = useAction();
  const [draft, setDraft] = useState<LifeRecord>(); const [selected, setSelected] = useState('');
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('All');
  const [outcome, setOutcome] = useState(''); const [lessons, setLessons] = useState('');
  const [legacy, setLegacy] = useState(() => readLegacyValue(lifeStoreKey(id)));
  useEffect(() => { setSelected(params.get('decision') ?? ''); setDraft(undefined); setOutcome(''); setLessons(''); }, [params]);
  const decision = store.value.records.find(record => record.id === selected);
  const records = store.value.records.filter(record => (filter === 'All' || (filter === 'Due' ? decisionIsDue(record) : record.status === filter)) && `${record.title} ${Object.values(record.values).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  return <ToolPage title="Decision Journal" notice={store.notice}>{action.alert}
    {legacy && <section className="space-y-2 border-b border-border pb-3"><p>Decisions from the earlier browser journal are available. Review them before copying them into this account.</p>
      <details><summary>Preview browser journal</summary><pre className="max-h-60 overflow-auto whitespace-pre-wrap text-sm">{legacy}</pre></details>
      <button className={field} disabled={!store.ready || action.busy} onClick={() => void action.run(async () => {
        const incoming = validateDecisions(JSON.parse(legacy));
        await store.save(previous => ({ ...previous, records: [...previous.records, ...incoming.records.filter(record => !previous.records.some(old => old.id === record.id))] })); setLegacy(null);
      })}>Copy browser decisions into this account</button><p className="text-xs">The original browser journal is retained for recovery. Existing decision IDs are preserved.</p>
    </section>}
    <div className="flex flex-wrap gap-3"><button className={field} disabled={!store.ready || action.busy} onClick={() => { setDraft(newLearningRecord('Pending review', 'Personal')); setSelected(''); }}>New decision</button>
      <label>Search decisions<input className={field} value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label>Decision filter<select aria-label="Decision filter" className={field} value={filter} onChange={e => setFilter(e.target.value)}>{['All', 'Due', 'Pending review', 'Reviewed', 'Archived'].map(option => <option key={option}>{option}</option>)}</select></label>
      <button className={field} disabled={!store.ready} onClick={() => download('decision-journal.json', store.value)}>Export journal</button>
    </div>
    {!records.length && <p>No matching decisions.</p>}
    <ul className="divide-y divide-border">{records.map(record => <li key={record.id} className="py-2"><button className="underline" disabled={action.busy} onClick={() => { setSelected(record.id); setDraft(undefined); setOutcome(''); setLessons(''); }}>{record.title}</button> · {decisionIsDue(record) ? 'Due for review' : record.status}{record.date && ` · Review ${record.date}`}</li>)}</ul>
    {draft && <form className="space-y-3 border-t border-border pt-4" onSubmit={e => { e.preventDefault(); void action.run(async () => {
      validateDecision(draft); await store.save(previous => ({ ...previous, records: [{ ...draft, title: draft.title.trim() }, ...previous.records.filter(record => record.id !== draft.id)] })); setSelected(draft.id); setDraft(undefined);
    }); }}><fieldset disabled={!store.ready || action.busy} className="space-y-3"><legend className="font-medium">{store.value.records.some(record => record.id === draft.id) ? 'Edit decision' : 'New decision'}</legend>
      <label className="block">Title<input className={`${field} block w-full`} required value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
      {fields.map(([key, label]) => <label key={key} className="block">{label}<textarea className={`${field} block w-full`} required={key === 'choice' || key === 'expectedOutcome'} value={draft.values[key] ?? ''} onChange={e => setDraft({ ...draft, values: { ...draft.values, [key]: e.target.value } })} /></label>)}
      <label className="block">Confidence (%)<input className={`${field} block`} type="number" min="0" max="100" value={draft.values.confidence ?? ''} onChange={e => setDraft({ ...draft, values: { ...draft.values, confidence: e.target.value } })} /></label>
      <label className="block">Review date<input className={`${field} block`} type="date" value={draft.date ?? ''} onChange={e => setDraft({ ...draft, date: e.target.value || undefined })} /></label>
      <label className="block">Evidence note<select aria-label="Evidence note" className={`${field} block`} value={draft.values.sourceNoteId ?? ''} onChange={e => setDraft({ ...draft, values: { ...draft.values, sourceNoteId: e.target.value } })}><option value="">None</option>{data.notes.map(note => <option key={note.id} value={note.id}>{note.title}</option>)}</select></label>
      <button className={field}>Save decision</button><button type="button" className={`${field} ml-2`} onClick={() => setDraft(undefined)}>Cancel</button>
    </fieldset></form>}
    {decision && !draft && <section className="space-y-3 border-t border-border pt-4"><h2 className="font-medium">{decision.title}</h2>
      <dl className="space-y-3">{[...fields, ['actualOutcome', 'Actual outcome'], ['lessons', 'Lessons learned']].map(([key, label]) => <div key={key}><dt className="text-sm font-medium">{label}</dt><dd className="whitespace-pre-wrap text-sm">{decision.values[key] || 'Not recorded'}</dd></div>)}</dl>
      <p>Confidence: {decision.values.confidence ? `${decision.values.confidence}%` : 'Not recorded'}</p>
      {decision.values.sourceNoteId && <button className="underline" onClick={() => onOpenNote(Number(decision.values.sourceNoteId))}>Open evidence note</button>}
      <fieldset disabled={action.busy || !store.ready} className="space-y-3"><div className="flex flex-wrap gap-2"><button className={field} onClick={() => setDraft(decision)}>Edit decision</button>
        <button className={field} onClick={() => void action.run(() => store.save(previous => ({ ...previous, records: previous.records.map(record => record.id === decision.id ? { ...record, status: record.status === 'Archived' ? record.values.reviewedOn ? 'Reviewed' : 'Pending review' : 'Archived' } : record) })))}>{decision.status === 'Archived' ? 'Unarchive decision' : 'Archive decision'}</button>
        <button className={field} onClick={() => { if (window.confirm('Delete this decision and its review history?')) void action.run(async () => { await store.save(previous => ({ ...previous, records: previous.records.filter(record => record.id !== decision.id) })); setSelected(''); }); }}>Delete decision</button></div>
        <label className="block">Actual outcome<textarea className={`${field} block w-full`} value={outcome} onChange={e => setOutcome(e.target.value)} /></label>
        <label className="block">Lessons learned<textarea className={`${field} block w-full`} value={lessons} onChange={e => setLessons(e.target.value)} /></label>
        <button className={field} disabled={!outcome.trim()} onClick={() => void action.run(async () => { await store.save(previous => ({ ...previous, records: previous.records.map(record => record.id === decision.id ? reviewDecision(record, outcome, lessons) : record) })); setOutcome(''); setLessons(''); })}>Complete review</button>
      </fieldset>
      <h3 className="font-medium">Review history</h3><ol className="space-y-2">{decision.log.map(log => <li key={log.id}><time>{log.date}</time><p className="whitespace-pre-wrap text-sm">{log.title}</p></li>)}</ol>
    </section>}
  </ToolPage>;
}
