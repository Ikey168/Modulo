import { useWorkspaceIndex } from '../../useWorkspaceIndex';
import { searchExcerpt } from '../../searchIndex';
import { useWorkspaceSearch } from '../../useWorkspaceSearch';
import { entityPath } from '../../entityNavigation';
/* eslint-disable react-refresh/only-export-components -- lazy plugin modules export contribution descriptors alongside their private React surfaces */
import { useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {
  BarChart3,
  Brain,
  Check,
  Clock3,
  Download,
  ExternalLink,
  FileDown,
  Fingerprint,
  Github,
  Link2,
  Paperclip,
  Pause,
  Play,
  RefreshCw,
  Search,
  Sigma,
  Stamp,
  Workflow,
} from 'lucide-react';
import { Badge, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui';
import { authService } from '../../../auth/authService';
import { KnowledgePanel } from '../../../knowledge/KnowledgePanel';
import { exportApi } from '../../../notes/editor/exportApi';
import { metaMaskService, type MetaMaskUser } from '../../../../services/metamask';
import {
  base64Utf8,
  downloadFile,
  graphMetrics,
  noteText,
  safeFilename,
  sha256,
} from '../../advancedTools';
import type { NoteFenceProps, NotePanelProps, PluginModule, WorkspaceViewProps } from '../types';
import { useDurableRecord } from '../useDurableRecord';
import { PluginStateNotice } from '../PluginStateNotice';
import { MermaidFence } from '../../MermaidFence';

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = await authService.getAccessToken();
  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

function ToolShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-1 flex-col overflow-y-auto"><header className="border-b border-border px-4 py-2.5"><h2 className="text-sm font-semibold">{title}</h2><p className="sr-only">{subtitle}</p></header><div className="p-4">{children}</div></div>;
}

function ErrorText({ value }: { value: string | null }) {
  return value ? <p className="mt-2 break-words text-xs text-destructive">{value}</p> : null;
}

// ── LaTeX + Mermaid renderers ──────────────────────────────────────────────

function MathFence({ source }: NoteFenceProps) {
  const html = useMemo(() => katex.renderToString(source.trim(), { displayMode: true, throwOnError: false, strict: 'warn', trust: false }), [source]);
  return <div className="my-4 overflow-x-auto rounded-md border border-border bg-surface px-4 py-5 text-center" dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── AI summary ─────────────────────────────────────────────────────────────

interface AnalysisResponse {
  summaryResult?: { success?: boolean; summary?: string; error?: string; model?: string; mock?: boolean };
  keyPointsResult?: { success?: boolean; keyPoints?: string[] };
  summary?: string | { success?: boolean; summary?: string; error?: string; model?: string; mock?: boolean };
  keyPoints?: string[] | { success?: boolean; keyPoints?: string[] };
  error?: string;
}

function AiSummaryPanel({ note }: NotePanelProps) {
  const [summary, setSummary] = useState('');
  const [points, setPoints] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setSummary(''); setPoints([]); setError(null); }, [note.id]);
  const generate = async () => {
    setBusy(true); setError(null);
    try {
      const result = await requestJson<AnalysisResponse>(`/api/plugin/ai-notes-summarization/notes/${note.id}/analyze`, { method: 'POST', body: JSON.stringify({ maxKeyPoints: 5, summaryRequest: { length: 'MEDIUM', style: 'CASUAL' } }) });
      const summaryResult = result.summaryResult ?? (typeof result.summary === 'object' ? result.summary : undefined);
      const keyPointsResult = result.keyPointsResult ?? (result.keyPoints && !Array.isArray(result.keyPoints) ? result.keyPoints : undefined);
      const nextSummary = summaryResult?.summary ?? (typeof result.summary === 'string' ? result.summary : '');
      if (!nextSummary) throw new Error(summaryResult?.error ?? result.error ?? 'The AI service returned no summary.');
      setSummary(nextSummary);
      setPoints(keyPointsResult?.keyPoints ?? (Array.isArray(result.keyPoints) ? result.keyPoints : []));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Summary failed'); }
    finally { setBusy(false); }
  };

  return <div className="space-y-2"><Button size="sm" variant="outline" className="w-full" disabled={busy} onClick={() => void generate()}><Brain className="size-3.5" />{busy ? 'Analyzing…' : 'Generate summary'}</Button>{summary && <><p className="whitespace-pre-wrap text-xs leading-relaxed">{summary}</p>{points.length > 0 && <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">{points.map((point) => <li key={point}>{point}</li>)}</ul>}<Button size="sm" variant="ghost" className="w-full" onClick={() => void navigator.clipboard.writeText(summary)}><Check className="size-3.5" />Copy summary</Button></>}<ErrorText value={error} /></div>;
}

// ── GitHub sync ────────────────────────────────────────────────────────────

const GITHUB_CONFIG_KEY = 'modulo-github-sync-config-v1';
interface GitHubConfig { repository: string; branch: string; path: string }
const DEFAULT_GITHUB_CONFIG: GitHubConfig = { repository: '', branch: 'main', path: 'modulo-notes' };
function validateGitHubConfig(value: unknown): GitHubConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid GitHub settings');
  const raw = value as Partial<GitHubConfig>;
  if (typeof raw.repository !== 'string' || typeof raw.branch !== 'string' || typeof raw.path !== 'string') throw new Error('Invalid GitHub settings');
  return { repository: raw.repository, branch: raw.branch, path: raw.path };
}
const encodePath = (path: string) => path.split('/').filter(Boolean).map(encodeURIComponent).join('/');

function GitHubSyncView({ data }: WorkspaceViewProps) {
  const record = useDurableRecord('github-sync', 'config', 'modulo.github-sync.config',
    DEFAULT_GITHUB_CONFIG, validateGitHubConfig, GITHUB_CONFIG_KEY);
  const config = record.value;
  const setConfig = record.set;
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sync = async () => {
    const match = /^([^/]+)\/([^/]+)$/.exec(config.repository.trim());
    if (!record.ready) return setError('Sign in before saving GitHub settings.');
    if (!match) return setError('Repository must use owner/name format.');
    if (!token.trim()) return setError('Enter a fine-grained GitHub token for this session. It is never stored.');
    setBusy(true); setError(null);
    try {
      const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token.trim()}` };
      for (let index = 0; index < data.notes.length; index += 1) {
        const note = data.notes[index]!;
        setStatus(`Syncing ${index + 1}/${data.notes.length}: ${note.title}`);
        const filename = `${note.id}-${safeFilename(note.title)}.md`;
        const path = encodePath(`${config.path}/${filename}`);
        const url = `https://api.github.com/repos/${encodeURIComponent(match[1]!)}/${encodeURIComponent(match[2]!)}/contents/${path}`;
        const existing = await fetch(`${url}?ref=${encodeURIComponent(config.branch)}`, { headers });
        let fileSha: string | undefined;
        if (existing.ok) fileSha = ((await existing.json()) as { sha?: string }).sha;
        else if (existing.status !== 404) throw new Error(`GitHub lookup failed for ${filename}: ${existing.status}`);
        const response = await fetch(url, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Sync Modulo note: ${note.title}`, branch: config.branch, content: base64Utf8(`# ${note.title}\n\n${note.markdownContent ?? note.content ?? ''}\n`), ...(fileSha ? { sha: fileSha } : {}) }) });
        if (!response.ok) throw new Error(`GitHub write failed for ${filename}: ${response.status} ${await response.text()}`);
      }
      setStatus(`Synced ${data.notes.length} notes to ${config.repository}/${config.path}.`);
      setToken('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'GitHub sync failed'); }
    finally { setBusy(false); }
  };

  const snapshot = () => downloadFile('modulo-github-snapshot.json', JSON.stringify(data.notes.map((note) => ({ id: note.id, title: note.title, markdown: note.markdownContent ?? note.content ?? '', updatedAt: note.updatedAt })), null, 2), 'application/json');
  return <ToolShell title="GitHub Sync" subtitle="Commit the vault as Markdown. Repository settings sync through Modulo; the token only lives in memory until sync finishes."><PluginStateNotice {...record} />{record.legacy && <Button size="sm" variant="outline" onClick={record.importLegacy}>Import browser settings</Button>}<div className="grid max-w-2xl gap-3 sm:grid-cols-2"><label className="space-y-1 text-xs">Repository (owner/name)<Input disabled={!record.ready} value={config.repository} onChange={(event) => setConfig({ ...config, repository: event.target.value })} placeholder="owner/notes" /></label><label className="space-y-1 text-xs">Branch<Input disabled={!record.ready} value={config.branch} onChange={(event) => setConfig({ ...config, branch: event.target.value })} /></label><label className="space-y-1 text-xs">Directory<Input disabled={!record.ready} value={config.path} onChange={(event) => setConfig({ ...config, path: event.target.value })} /></label><label className="space-y-1 text-xs">Fine-grained token (session only)<Input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder="github_pat_…" /></label></div><div className="mt-4 flex flex-wrap gap-2"><Button disabled={!record.ready || busy || data.notes.length === 0} onClick={() => void sync()}><Github className="size-4" />{busy ? 'Syncing…' : `Sync ${data.notes.length} notes`}</Button><Button variant="outline" onClick={snapshot}><Download className="size-4" />Download snapshot</Button></div>{status && <p className="mt-3 text-xs text-muted-foreground">{status}</p>}<ErrorText value={error} /></ToolShell>;
}

// ── PDF / export ───────────────────────────────────────────────────────────

function PdfExportPanel({ note, allNotes = [] }: NotePanelProps) {
  return <div className="space-y-1.5"><Button size="sm" variant="outline" className="w-full justify-start" onClick={() => void exportApi.openHtmlForPrint(note.id, true)}><FileDown className="size-3.5" />Print / PDF note</Button><Button size="sm" variant="outline" className="w-full justify-start" onClick={() => void exportApi.downloadZip(allNotes.map((item) => item.id), true)}><Download className="size-3.5" />Download vault ZIP</Button></div>;
}

// ── Graph analytics ────────────────────────────────────────────────────────

function GraphAnalyticsView({ data, graphLinks, setSelectedId, navigateView }: WorkspaceViewProps) {
  const metrics = useMemo(() => graphMetrics(data.notes, graphLinks), [data.notes, graphLinks]);
  return <ToolShell title="Graph analytics" subtitle="Local structural analysis of your current note-link graph."><dl className="flex flex-wrap gap-x-8 gap-y-2 border-y border-border py-3">{[['Notes', metrics.nodeCount], ['Links', metrics.edgeCount], ['Density', metrics.density.toFixed(3)], ['Components', metrics.components], ['Orphans', metrics.orphans]].map(([label, value]) => <div key={label} className="min-w-20 border-l border-border pl-3"><dd className="text-base font-semibold tabular-nums">{value}</dd><dt className="text-xs text-muted-foreground">{label}</dt></div>)}</dl><section className="mt-5 max-w-3xl"><h3 className="mb-2 text-xs font-medium text-muted-foreground">Most central notes</h3>{metrics.ranked.length === 0 ? <div className="border-y border-dashed border-border px-3 py-5"><p className="text-sm font-medium">No graph data</p><p className="mt-0.5 text-xs text-muted-foreground">Create and link notes to populate analytics.</p></div> : <div className="divide-y divide-border border-y border-border">{metrics.ranked.slice(0, 25).map((metric, index) => <button key={metric.note.id} className="grid w-full grid-cols-[2rem_1fr_auto_auto] items-center gap-3 px-3 py-2 text-left text-xs hover:bg-muted" onClick={() => { setSelectedId(metric.note.id); navigateView('notes'); }}><span className="font-mono text-muted-foreground">#{index + 1}</span><span className="truncate font-medium">{metric.note.title}</span><span className="text-muted-foreground">degree {metric.degree}</span><span className="font-mono text-muted-foreground">PR {metric.pageRank.toFixed(3)}</span></button>)}</div>}</section></ToolShell>;
}

// ── Web3 identity ──────────────────────────────────────────────────────────

interface IdentityProof { address: string; chainId: number; network: string; statement: string; signature: string; signedAt: string }
const IDENTITY_KEY = 'modulo-web3-identity-v1';
function validateIdentity(value: unknown): IdentityProof | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid identity proof');
  const proof = value as Partial<IdentityProof>;
  if (typeof proof.address !== 'string' || typeof proof.chainId !== 'number' || !Number.isFinite(proof.chainId)
    || typeof proof.network !== 'string' || typeof proof.statement !== 'string'
    || typeof proof.signature !== 'string' || typeof proof.signedAt !== 'string') throw new Error('Invalid identity proof');
  return proof as IdentityProof;
}

function Web3IdentityView() {
  const [account, setAccount] = useState<MetaMaskUser | null>(null);
  const record = useDurableRecord('web3-id', 'proof', 'modulo.web3-identity.proof', null as IdentityProof | null,
    validateIdentity, IDENTITY_KEY);
  const proof = record.value;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const connect = async () => { setBusy(true); setError(null); try { setAccount(await metaMaskService.connect()); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Wallet connection failed'); } finally { setBusy(false); } };
  const sign = async () => {
    if (!account) return;
    setBusy(true); setError(null);
    try {
      const signedAt = new Date().toISOString();
      const statement = `Modulo identity proof\nAddress: ${account.walletAddress}\nOrigin: ${location.origin}\nSigned at: ${signedAt}`;
      const next = { address: account.walletAddress, chainId: account.chainId, network: account.networkName, statement, signature: await metaMaskService.signMessage(statement), signedAt };
      record.set(next);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Signing failed'); }
    finally { setBusy(false); }
  };
  return <ToolShell title="Web3 Identity" subtitle="Create a portable EIP-191 wallet signature. Modulo stores only the public address, statement, and signature."><PluginStateNotice {...record} />{record.legacy && <Button size="sm" variant="outline" onClick={record.importLegacy}>Import browser proof</Button>}<div className="max-w-xl rounded-md border border-border p-4">{account ? <div className="space-y-3"><div><p className="font-mono text-xs">{account.walletAddress}</p><p className="text-xs text-muted-foreground">{account.networkName} · chain {account.chainId}</p></div><Button disabled={!record.ready || busy} onClick={() => void sign()}><Fingerprint className="size-4" />Sign identity statement</Button></div> : <Button disabled={busy} onClick={() => void connect()}><Fingerprint className="size-4" />Connect wallet</Button>}<ErrorText value={error} />{proof && <div className="mt-4 space-y-2 border-t border-border pt-4"><div className="flex items-center gap-2 text-xs font-medium text-emerald-500"><Check className="size-4" />Signed {new Date(proof.signedAt).toLocaleString()}</div><p className="break-all font-mono text-xxs text-muted-foreground">{proof.signature}</p><Button size="sm" variant="outline" onClick={() => downloadFile('modulo-identity-proof.json', JSON.stringify(proof, null, 2), 'application/json')}><Download className="size-3.5" />Export proof</Button></div>}</div></ToolShell>;
}

// ── Focus timer ────────────────────────────────────────────────────────────

interface FocusSession { id: string; noteId?: number; noteTitle?: string; minutes: number; completedAt: string }
const FOCUS_KEY = 'modulo-focus-sessions-v1';
function validateFocus(value: unknown): FocusSession[] {
  if (!Array.isArray(value) || value.some((session) => !session || typeof session !== 'object'
    || typeof session.id !== 'string' || typeof session.minutes !== 'number'
    || !Number.isFinite(session.minutes) || typeof session.completedAt !== 'string'
    || (session.noteId !== undefined && typeof session.noteId !== 'number')
    || (session.noteTitle !== undefined && typeof session.noteTitle !== 'string'))) throw new Error('Invalid focus sessions');
  return value as FocusSession[];
}

function FocusTimerView({ data, selectedId }: WorkspaceViewProps) {
  const [minutes, setMinutes] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [noteId, setNoteId] = useState<number | undefined>(selectedId ?? undefined);
  const record = useDurableRecord('focus', 'sessions', 'modulo.focus.sessions', [] as FocusSession[],
    validateFocus, FOCUS_KEY);
  const sessions = record.value;
  const startedFor = useRef(minutes);
  const complete = () => {
    const note = data.notes.find((item) => item.id === noteId);
    const next = [{ id: crypto.randomUUID(), noteId, noteTitle: note?.title, minutes: startedFor.current, completedAt: new Date().toISOString() }, ...sessions].slice(0, 100);
    record.set(next); setRunning(false); setRemaining(minutes * 60);
  };
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setRemaining((value) => { if (value <= 1) { window.clearInterval(timer); queueMicrotask(complete); return 0; } return value - 1; }), 1000);
    return () => window.clearInterval(timer);
  });
  const reset = (nextMinutes = minutes) => { setRunning(false); setRemaining(nextMinutes * 60); startedFor.current = nextMinutes; };
  const display = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  return <ToolShell title="Focus timer" subtitle="A distraction-free timer with completed sessions linked to notes."><PluginStateNotice {...record} />{record.legacy && <Button size="sm" variant="outline" onClick={record.importLegacy}>Import browser sessions</Button>}<div className="max-w-4xl space-y-5"><section className="border-y border-border p-5 text-center"><div className="font-mono text-5xl font-semibold tabular-nums">{display}</div><div className="mt-4 flex justify-center gap-2">{[25, 50, 90].map((value) => <Button key={value} size="sm" variant={minutes === value ? 'primary' : 'outline'} disabled={running} onClick={() => { setMinutes(value); reset(value); }}>{value}m</Button>)}</div><div className="mx-auto mt-4 max-w-xs space-y-1 text-left"><Label className="text-xs text-muted-foreground">Linked note</Label><Select value={noteId == null ? 'none' : String(noteId)} onValueChange={(value) => setNoteId(value === 'none' ? undefined : Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No note</SelectItem>{data.notes.map((note) => <SelectItem key={note.id} value={String(note.id)}>{note.title}</SelectItem>)}</SelectContent></Select></div><div className="mt-4 flex justify-center gap-2"><Button disabled={!record.ready} onClick={() => { startedFor.current = minutes; setRunning((value) => !value); }}>{running ? <Pause className="size-4" /> : <Play className="size-4" />}{running ? 'Pause' : 'Start'}</Button><Button variant="outline" onClick={() => reset()}><RefreshCw className="size-4" />Reset</Button></div></section><section><h3 className="mb-2 text-xs font-medium text-muted-foreground">Completed sessions</h3>{sessions.length === 0 ? <p className="text-xs text-muted-foreground">No completed sessions yet.</p> : <div className="divide-y divide-border border-y border-border">{sessions.slice(0, 12).map((session) => <div key={session.id} className="flex items-center gap-3 px-3 py-2 text-xs"><Clock3 className="size-4 text-primary" /><span className="min-w-0 flex-1 truncate">{session.noteTitle ?? 'Unlinked focus'}</span><span className="tabular-nums text-muted-foreground">{session.minutes}m</span><span className="text-muted-foreground">{new Date(session.completedAt).toLocaleDateString()}</span></div>)}</div>}</section></div></ToolShell>;
}

// ── IPFS + timestamp proofs ────────────────────────────────────────────────

interface IpfsResult { success?: boolean; ipfsCid?: string; gatewayUrl?: string; error?: string; isValid?: boolean }
function IpfsPanel({ note }: NotePanelProps) {
  const [result, setResult] = useState<IpfsResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pin = async () => { setBusy(true); setError(null); try { setResult(await requestJson<IpfsResult>(`/api/ipfs/notes/${note.id}/upload`, { method: 'POST' })); } catch (reason) { setError(reason instanceof Error ? reason.message : 'IPFS pin failed'); } finally { setBusy(false); } };
  const cid = result?.ipfsCid ?? note.ipfsCid;
  return <div className="space-y-2"><Button size="sm" variant="outline" className="w-full" disabled={busy} onClick={() => void pin()}><Paperclip className="size-3.5" />{busy ? 'Pinning…' : cid ? 'Pin new version' : 'Pin note to IPFS'}</Button>{cid && <div><p className="break-all font-mono text-xxs text-muted-foreground">{cid}</p>{result?.gatewayUrl && <a className="mt-1 flex items-center gap-1 text-xs text-primary" href={result.gatewayUrl} target="_blank" rel="noreferrer">Open gateway <ExternalLink className="size-3" /></a>}</div>}<ErrorText value={error} /></div>;
}

interface TimestampManifest { format: 'modulo-timestamp-proof'; version: 1; algorithm: 'SHA-256'; digest: string; noteId: number; title: string; createdAt: string; blockchainTxHash?: string; ipfsCid?: string }
function TimestampPanel({ note }: NotePanelProps) {
  const [proof, setProof] = useState<TimestampManifest | null>(null);
  useEffect(() => { setProof(null); }, [note.id]);
  const create = async () => setProof({ format: 'modulo-timestamp-proof', version: 1, algorithm: 'SHA-256', digest: await sha256(noteText(note)), noteId: note.id, title: note.title, createdAt: new Date().toISOString(), blockchainTxHash: note.blockchainTxHash, ipfsCid: note.ipfsCid });
  return <div className="space-y-2"><Button size="sm" variant="outline" className="w-full" onClick={() => void create()}><Stamp className="size-3.5" />Create timestamp manifest</Button>{proof && <><p className="break-all font-mono text-xxs text-muted-foreground">sha256:{proof.digest}</p><div className="flex flex-wrap gap-1">{proof.blockchainTxHash && <Badge>Chain anchored</Badge>}{proof.ipfsCid && <Badge>IPFS pinned</Badge>}{!proof.blockchainTxHash && !proof.ipfsCid && <Badge variant="outline">Local timestamp</Badge>}</div><Button size="sm" variant="ghost" className="w-full" onClick={() => downloadFile(`${safeFilename(note.title)}.timestamp.json`, JSON.stringify(proof, null, 2), 'application/json')}><Download className="size-3.5" />Download proof</Button></>}</div>;
}

// ── Semantic search + auto-linker ──────────────────────────────────────────

interface SemanticHit { noteId: number; title: string; score: number; lexicalScore: number; vectorScore: number; provider: string; model: string; version: string; excerpt: string }
interface AskAnswer { answer: string; answered: boolean; providerMode: string; notice: string; citations: { noteId: number; title: string; excerpt: string }[] }
function SemanticSearchView({ data, setSelectedId, navigateView }: WorkspaceViewProps) {
  const entities = useWorkspaceIndex(data.notes);
  const [query, setQuery] = useState('');
  const workspaceMatches = useWorkspaceSearch(entities, query);
  const [results, setResults] = useState<SemanticHit[]>([]);
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerMode, setProviderMode] = useState<'LOCAL'|'REMOTE'>('LOCAL');
  const [remoteConsent, setRemoteConsent] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!query.trim()) { setResults([]); setAnswer(null); return; }
    const controller = new AbortController(); abortRef.current?.abort(); abortRef.current = controller;
    const timer = window.setTimeout(() => {
      requestJson<SemanticHit[]>(`/api/knowledge/search?q=${encodeURIComponent(query)}&limit=20`, { signal: controller.signal })
        .then(setResults).catch((reason) => { if (reason instanceof DOMException && reason.name === 'AbortError') return; setError(reason instanceof Error ? reason.message : String(reason)); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);
  useEffect(() => { requestJson<{provider_mode?:'LOCAL'|'REMOTE';providerMode?:'LOCAL'|'REMOTE';remote_consent?:boolean;remoteConsent?:boolean;monthly_budget_cents?:number;monthlyBudgetCents?:number}>('/api/knowledge/preferences').then((value) => { setProviderMode(value.provider_mode ?? value.providerMode ?? 'LOCAL'); setRemoteConsent(value.remote_consent ?? value.remoteConsent ?? false); setMonthlyBudget(value.monthly_budget_cents ?? value.monthlyBudgetCents ?? 0); }).catch(() => {}); }, []);
  const saveProvider = async () => { setError(null); try { const value = await requestJson<{provider_mode?:'LOCAL'|'REMOTE';providerMode?:'LOCAL'|'REMOTE';remote_consent?:boolean;remoteConsent?:boolean;monthly_budget_cents?:number;monthlyBudgetCents?:number}>('/api/knowledge/preferences',{method:'PUT',body:JSON.stringify({providerMode,remoteConsent,monthlyBudgetCents:monthlyBudget})}); setProviderMode(value.provider_mode ?? value.providerMode ?? 'LOCAL'); setRemoteConsent(value.remote_consent ?? value.remoteConsent ?? false); } catch(reason){ setError(reason instanceof Error ? reason.message : String(reason)); } };
  const ask = async () => {
    abortRef.current?.abort(); const controller = new AbortController(); abortRef.current = controller; setBusy(true); setError(null); setAnswer(null);
    try { setAnswer(await requestJson<AskAnswer>('/api/knowledge/ask', { method: 'POST', signal: controller.signal, body: JSON.stringify({ question: query, maxCitations: 4 }) })); }
    catch (reason) { if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  return <ToolShell title="Semantic search & Ask Modulo" subtitle="Private hybrid retrieval and cited answers over your notes.">
    <div className="max-w-3xl space-y-3"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Describe what you are looking for…" autoFocus /></div>
      <div className="flex flex-wrap items-center gap-2"><Button size="sm" disabled={!query.trim() || busy} onClick={() => void ask()}><Brain className="size-3.5" />Ask Modulo</Button>{busy && <Button size="sm" variant="outline" onClick={() => abortRef.current?.abort()}>Cancel</Button>}<Badge variant="outline">{providerMode === 'LOCAL' ? 'Local provider · note text stays on your Modulo server' : 'Remote provider requested · explicit consent required'}</Badge></div>
      {query.trim() && <section aria-label="Workspace matches" className="divide-y divide-border"><h2 className="py-2 text-sm font-medium">Workspace matches</h2>{workspaceMatches.map(item => <button key={item.uid} className="block w-full py-2 text-left" onClick={() => navigateView(entityPath(item))}><span className="text-sm">{item.title} · {item.source}</span><span className="block text-xs text-muted-foreground">{searchExcerpt(item, query)}</span></button>)}</section>}
      <details className="rounded border border-border p-2 text-xs"><summary className="cursor-pointer font-medium">Provider privacy & budget controls</summary><div className="mt-2 grid max-w-xl gap-2"><Label>Provider mode<select className="mt-1 w-full rounded border border-border bg-background px-2 py-1" value={providerMode} onChange={(event)=>setProviderMode(event.target.value as 'LOCAL'|'REMOTE')}><option value="LOCAL">Local — no note text transmitted externally</option><option value="REMOTE">Remote — only when a provider is configured</option></select></Label>{providerMode==='REMOTE'&&<><label className="flex items-start gap-2"><input type="checkbox" checked={remoteConsent} onChange={(event)=>setRemoteConsent(event.target.checked)}/>I explicitly consent to sending retrieved note excerpts to the configured remote provider.</label><Label>Monthly remote budget (cents)<Input type="number" min={0} value={monthlyBudget} onChange={(event)=>setMonthlyBudget(Math.max(0,Number(event.target.value)||0))}/></Label></>}<Button size="sm" variant="outline" onClick={()=>void saveProvider()}>Save provider controls</Button><p className="text-muted-foreground">If no remote provider is configured, Modulo refuses remote mode rather than silently sending data or falling back to an unknown service.</p></div></details>
      <p className="text-xxs text-muted-foreground">Answers are extractive: note text is treated as untrusted data, instructions inside notes are not executed, and unsupported questions return no answer.</p><ErrorText value={error} />
      {answer && <section className="rounded-md border border-border p-3" aria-live="polite"><h3 className="text-sm font-semibold">Answer</h3><p className="mt-2 text-sm">{answer.answer}</p><p className="mt-2 text-xxs text-muted-foreground">{answer.notice}</p>{answer.citations.length > 0 && <ol className="mt-3 space-y-2">{answer.citations.map((citation, index) => <li key={`${citation.noteId}-${index}`} className="text-xs"><button className="font-medium text-primary hover:underline" onClick={() => { setSelectedId(citation.noteId); navigateView('notes'); }}>[{index + 1}] {citation.title}</button><p className="mt-0.5 text-muted-foreground">{citation.excerpt}</p></li>)}</ol>}</section>}
    </div>
    <div className="mt-4 max-w-3xl divide-y divide-border border-y border-border">{query && results.length === 0 && <div className="px-3 py-5"><p className="text-sm font-medium">No supported matches yet</p><p className="mt-0.5 text-xs text-muted-foreground">Try broader concepts, add more content, or run the embedding backfill.</p></div>}{results.map((result) => <button key={result.noteId} className="block w-full px-3 py-2.5 text-left hover:bg-muted/20" onClick={() => { setSelectedId(result.noteId); navigateView('notes'); }}><div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm font-medium">{result.title}</span><span className="font-mono text-xxs text-muted-foreground">{Math.round(result.score * 100)}%</span></div><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{result.excerpt}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">hybrid · lexical {result.lexicalScore.toFixed(3)} · semantic {result.vectorScore.toFixed(3)} · {result.provider}/{result.model}</p></button>)}</div>
  </ToolShell>;
}

interface SuggestedLink { id: string; sourceNoteId: number; targetNoteId: number; score: number; explanation: string; status: string }
function AutoLinkPanel({ note, allNotes = [] }: NotePanelProps) {
  const [suggestions, setSuggestions] = useState<SuggestedLink[]>([]); const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; requestJson<SuggestedLink[]>(`/api/knowledge/notes/${note.id}/suggestions?limit=6`).then((value) => { if (active) setSuggestions(value); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); }); return () => { active = false; }; }, [note.id]);
  const decide = async (id: string, decision: 'ACCEPTED'|'REJECTED'|'DISMISSED') => { try { await requestJson(`/api/knowledge/suggestions/${id}/decision`, { method:'POST', body: JSON.stringify({ decision }) }); setSuggestions((current) => current.filter((item) => item.id !== id)); window.dispatchEvent(new Event('modulo:links-changed')); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
  if (suggestions.length === 0) return <><p className="text-xs text-muted-foreground">No pending semantic link suggestions.</p><ErrorText value={error} /></>;
  return <div className="space-y-1.5">{suggestions.map((suggestion) => { const target = allNotes.find((item) => item.id === suggestion.targetNoteId); return <div key={suggestion.id} className="rounded-md border border-border p-2"><div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-xs font-medium">{target?.title ?? `Note ${suggestion.targetNoteId}`}</span><span className="font-mono text-xxs text-muted-foreground">{Math.round(suggestion.score*100)}%</span></div><p className="mt-1 text-xxs text-muted-foreground">{suggestion.explanation}</p><div className="mt-2 flex gap-1"><Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => void decide(suggestion.id,'ACCEPTED')}><Link2 className="size-3" />Link</Button><Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => void decide(suggestion.id,'REJECTED')}>Reject</Button><Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => void decide(suggestion.id,'DISMISSED')}>Dismiss</Button></div></div>; })}<ErrorText value={error} /></div>;
}

function KnowledgeNotePanel({ note, onSelectNote, onLinksChanged }: NotePanelProps) {
  return (
    <KnowledgePanel
      noteId={note.id}
      onSelect={onSelectNote ?? (() => undefined)}
      onLinksChanged={onLinksChanged ?? (async () => undefined)}
    />
  );
}

// ── Plugin modules ─────────────────────────────────────────────────────────

export const latexPlugin: PluginModule = { activate(ctx) { ctx.addNoteFence({ language: 'math', component: MathFence }); ctx.addNoteFence({ language: 'latex', component: MathFence }); ctx.addEditorAction({ id: 'insert-latex', label: 'Insert equation', icon: Sigma, run: ({ insertAtCursor }) => insertAtCursor('\n\n```math\nE = mc^2\n```\n\n') }); } };
export const mermaidPlugin: PluginModule = { activate(ctx) { ctx.addNoteFence({ language: 'mermaid', component: MermaidFence }); ctx.addEditorAction({ id: 'insert-mermaid', label: 'Insert diagram', icon: Workflow, run: ({ insertAtCursor }) => insertAtCursor('\n\n```mermaid\nflowchart LR\n  A[Start] --> B[Finish]\n```\n\n') }); } };
export const aiSummaryPlugin: PluginModule = { activate(ctx) { ctx.addNotePanel({ id: 'ai-summary', title: 'AI Summary', order: 20, component: AiSummaryPanel }); } };
export const githubSyncPlugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'github-sync', label: 'GitHub Sync', icon: Github, order: 10, mode: 'tools', section: 'Sync', component: GitHubSyncView }); } };
export const pdfExportPlugin: PluginModule = { activate(ctx) { ctx.addNotePanel({ id: 'pdf-export', title: 'Export', order: 30, component: PdfExportPanel }); } };
export const graphStatsPlugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'graph-stats', label: 'Graph Analytics', icon: BarChart3, order: 30, mode: 'tools', section: 'Analytics', component: GraphAnalyticsView }); } };
export const web3IdentityPlugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'web3-id', label: 'Web3 Identity', icon: Fingerprint, order: 40, mode: 'tools', section: 'Web3', component: Web3IdentityView }); } };
export const focusPlugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'focus', label: 'Focus', icon: Clock3, order: 80, mode: 'productivity', component: FocusTimerView }); } };
export const ipfsAttachPlugin: PluginModule = { activate(ctx) { ctx.addNotePanel({ id: 'ipfs-attach', title: 'IPFS', order: 40, component: IpfsPanel }); } };
export const timestampProofsPlugin: PluginModule = { activate(ctx) { ctx.addNotePanel({ id: 'timestamp-proofs', title: 'Timestamp Proof', order: 50, component: TimestampPanel }); } };
export const semanticSearchPlugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'semantic-search', label: 'Semantic Search', icon: Search, order: 20, mode: 'tools', section: 'AI', component: SemanticSearchView }); ctx.addNotePanel({ id: 'knowledge-search', title: 'Search knowledge', order: 5, standalone: true, component: KnowledgeNotePanel }); } };
export const autoLinkerPlugin: PluginModule = { activate(ctx) { ctx.addNotePanel({ id: 'auto-linker', title: 'Suggested Links', order: 10, component: AutoLinkPanel }); } };
