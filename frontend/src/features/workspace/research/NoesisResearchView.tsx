import { useEffect, useState } from 'react';
import { apiClient } from './api';
import type { ResearchRecord } from './model';
import { ResearchWithNoesis } from './ResearchWithNoesis';
import { ResearchResultCard } from './ResearchResultCard';
export default function NoesisResearchView() {
  const id = new URLSearchParams(window.location.search).get('research');
  const [record, setRecord] = useState<ResearchRecord>(); const [error, setError] = useState('');
  useEffect(() => { setRecord(undefined); setError(''); if (id) void apiClient.get<ResearchRecord>(`/research/noesis/${encodeURIComponent(id)}`).then(setRecord).catch(() => setError('Research result is unavailable.')); }, [id]);
  return <main className="mx-auto w-full max-w-4xl space-y-4 overflow-y-auto p-4 sm:p-6"><h1 className="text-2xl font-semibold">Research with Noesis</h1><p className="text-sm text-muted-foreground">Cited findings, evidence changes and linked work.</p>{error && <p role="alert">{error}</p>}{id ? record ? <ResearchResultCard record={record} onChange={setRecord} /> : !error && <p>Loading research…</p> : <ResearchWithNoesis expanded />}</main>;
}
