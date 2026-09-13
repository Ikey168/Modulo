import { useCallback, useEffect, useState } from 'react';
import { usePlugins } from '../PluginProvider';
import { usePluginState } from '../usePluginState';
import { intakeCall, intakePreflight } from './noesisIntakeApi';
import { importLegacyIntake, LEGACY_INTAKE_KEY, planLegacyIntakeMigration, undoLegacyIntake,
  type LegacyIntakePlan } from './legacyIntakeMigration';

type FeedItem = {
  item_id: string;
  title: string;
  original_url: string;
  source_version: number;
  decision: string | null;
  read_at_ms: number | null;
};
type InboxPage = { items: FeedItem[]; remaining_unprocessed: number };
type TrailVisit = { source_id: string; url: string; title: string; version: number;
  note?: string; saved: boolean; discovered_via?: string };
type SourceReference = { kind: string; id: string; namespace: string; version: number;
  locator: { url: string } };
type RelatedSuggestion = { suggestion_id: string; method: string; cross_domain: boolean;
  shared_terms: string[]; anchor: { title: string; reference: SourceReference };
  candidate: { source_id: string; title: string; url: string; reference: SourceReference } };
type SourceAnnotation = { body: string; source_version: number };
type Session = {
  session_id: string;
  mode: string;
  status: string;
  revision: number;
  duration_minutes: number;
  remaining_minutes?: number;
  inputs: { feed_item_ids?: string[] };
  data: { decisions?: Record<string, string>; trail?: TrailVisit[] };
  access_degraded?: boolean;
  unmet_completion_checks?: string[];
};
type Preferences = { namespace: string; lastSessionId?: string; pendingStartKey?: string;
  pendingExploreKey?: string; pendingCaptureKey?: string };

const buttonClass = 'rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50';
const noteKey = async (sessionId: string, visit: TrailVisit, body: string) => {
  const bytes = new TextEncoder().encode(JSON.stringify([sessionId, visit.source_id, visit.version, body]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `modulo-note-${[...new Uint8Array(digest)].slice(0, 20).map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
};

export function NoesisIntakeView() {
  const plugins = usePlugins();
  const preferences = usePluginState<Preferences>(
    'information-intake', 'preferences', { namespace: 'research' }, 'modulo.intake.preferences');
  const namespace = preferences.value.namespace;
  const [namespaceDraft, setNamespaceDraft] = useState(namespace);
  const [preflight, setPreflight] = useState<{ available: boolean; reason?: string }>();
  const [page, setPage] = useState<InboxPage>();
  const [session, setSession] = useState<Session>();
  const [feedUrl, setFeedUrl] = useState('');
  const [feedName, setFeedName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [curiosity, setCuriosity] = useState('');
  const [explorationMinutes, setExplorationMinutes] = useState(90);
  const [captureUrl, setCaptureUrl] = useState('');
  const [captureTitle, setCaptureTitle] = useState('');
  const [captureNote, setCaptureNote] = useState('');
  const [captureSaved, setCaptureSaved] = useState(false);
  const [fetchReadable, setFetchReadable] = useState(false);
  const [suggestions, setSuggestions] = useState<RelatedSuggestion[]>([]);
  const [suggestionRefresh, setSuggestionRefresh] = useState(0);
  const [selectedVisit, setSelectedVisit] = useState<TrailVisit>();
  const [sourceAnnotations, setSourceAnnotations] = useState<SourceAnnotation[]>([]);
  const [annotationBody, setAnnotationBody] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [migration, setMigration] = useState<LegacyIntakePlan>();
  const [migrationResult, setMigrationResult] = useState<{
    staged: number; confirmed: number; pending: number; conflicts: number;
    reportPending: boolean; reportConflict: boolean; reportKey: string;
  }>();
  const [undoResult, setUndoResult] = useState<{ pending: number; conflicts: number }>();
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [migrationError, setMigrationError] = useState<string>();

  const load = useCallback(async () => {
    const readiness = await intakePreflight();
    setPreflight(readiness);
    if (!readiness.available) { setPage(undefined); setSession(undefined);
      setSelectedVisit(undefined); setSourceAnnotations([]); return; }
    const inbox = await intakeCall<InboxPage>('list_intake_feed_inbox', { namespace, limit: 50 });
    setPage(inbox);
  }, [namespace]);

  useEffect(() => {
    if (!preferences.ready) return;
    let active = true;
    void load().catch(cause => { if (active) { setSession(undefined); setSelectedVisit(undefined);
      setSourceAnnotations([]); setError(String(cause)); } });
    return () => { active = false; };
  }, [load, preferences.ready]);
  useEffect(() => setNamespaceDraft(namespace), [namespace]);
  useEffect(() => { setSelectedVisit(undefined); setSourceAnnotations([]); }, [session?.session_id]);
  useEffect(() => {
    const sessionId = preferences.value.lastSessionId;
    if (!preferences.ready || !sessionId) return;
    let active = true;
    void intakeCall<Session>('inspect_intake_mode', { namespace, session_id: sessionId })
      .then(current => { if (active) setSession(current); })
      .catch(cause => { if (active) { setSession(undefined); setSelectedVisit(undefined);
        setSourceAnnotations([]); setError(String(cause)); } });
    return () => { active = false; };
  }, [namespace, preferences.ready, preferences.value.lastSessionId]);
  useEffect(() => {
    if (session?.mode !== 'Exploration' || session.status !== 'active' || session.access_degraded) {
      setSuggestions([]); return;
    }
    let active = true;
    void intakeCall<{ suggestions: RelatedSuggestion[] }>('suggest_exploration_sources', {
      namespace, session_id: session.session_id,
    }).then(result => { if (active) setSuggestions(Array.isArray(result.suggestions) ? result.suggestions : []); })
      .catch(cause => { if (active) setError(String(cause)); });
    return () => { active = false; };
  }, [namespace, session?.access_degraded, session?.mode, session?.revision,
    session?.session_id, session?.status, suggestionRefresh]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(undefined);
    try { await action(); await load(); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      try {
        await load();
        if (session?.session_id) {
          setSession(await intakeCall<Session>('inspect_intake_mode', {
            namespace, session_id: session.session_id,
          }));
        }
      } catch {
        setSession(undefined); setSelectedVisit(undefined); setSourceAnnotations([]);
      }
    }
    finally { setBusy(false); }
  };

  const saveNamespace = () => run(async () => {
    const next = namespaceDraft.trim();
    if (!next || next.length > 128) throw new Error('Enter a namespace of at most 128 characters.');
    await preferences.set({ namespace: next });
    setSession(undefined); setSelectedVisit(undefined); setSourceAnnotations([]);
    setPage(undefined);
  });

  const subscribe = () => run(async () => {
    await intakeCall('subscribe_intake_feed', {
      namespace, url: feedUrl.trim(), name: feedName.trim() || feedUrl.trim(),
    });
    setFeedUrl(''); setFeedName('');
  });

  const startAwareness = () => run(async () => {
    const requestKey = preferences.value.pendingStartKey ?? `modulo-awareness-${crypto.randomUUID()}`;
    if (!preferences.value.pendingStartKey) {
      await preferences.set({ ...preferences.value, pendingStartKey: requestKey });
    }
    const next = await intakeCall<Session>('start_awareness_from_inbox', {
      namespace, request_key: requestKey,
    });
    await preferences.set({ namespace, lastSessionId: next.session_id });
    setSession(next);
  });

  const startExploration = () => run(async () => {
    const requestKey = preferences.value.pendingExploreKey ?? `modulo-exploration-${crypto.randomUUID()}`;
    if (!preferences.value.pendingExploreKey) {
      await preferences.set({ ...preferences.value, pendingExploreKey: requestKey });
    }
    const next = await intakeCall<Session>('start_intake_mode', {
      namespace, mode: 'Exploration', request_key: requestKey,
      intent: curiosity.trim() || 'Browse freely', duration_minutes: explorationMinutes,
    });
    await preferences.set({ namespace, lastSessionId: next.session_id });
    setSession(next);
  });

  const capturePage = () => run(async () => {
    if (!session || session.mode !== 'Exploration' || session.status !== 'active')
      throw new Error('Start or resume Exploration before capturing.');
    const requestKey = preferences.value.pendingCaptureKey ?? `modulo-capture-${crypto.randomUUID()}`;
    if (!preferences.value.pendingCaptureKey) {
      await preferences.set({ ...preferences.value, pendingCaptureKey: requestKey });
    }
    const next = await intakeCall<Session>('capture_exploration_page', {
      namespace, session_id: session.session_id, command_key: requestKey,
      expected_revision: session.revision, url: captureUrl.trim(),
      title: captureTitle.trim() || captureUrl.trim(), note: captureNote.trim(),
      saved: captureSaved, fetch_readable: fetchReadable,
    });
    const clean = { ...preferences.value }; delete clean.pendingCaptureKey;
    await preferences.set(clean);
    setSession(next);
    setCaptureUrl(''); setCaptureTitle(''); setCaptureNote('');
    setCaptureSaved(false); setFetchReadable(false);
  });

  const visitFeedItem = (item: FeedItem) => run(async () => {
    if (!session || session.mode !== 'Exploration' || session.status !== 'active') return;
    const next = await intakeCall<Session>('visit_exploration_feed_item', {
      namespace, session_id: session.session_id, item_id: item.item_id,
      command_key: `modulo-feedvisit-${session.session_id}-${item.item_id}`,
      expected_revision: session.revision, saved: true,
    });
    setSession(next);
  });

  const updateExploration = (action: 'pause' | 'resume' | 'complete') => run(async () => {
    if (!session || session.mode !== 'Exploration') return;
    const next = await intakeCall<Session>('command_intake_mode', {
      namespace, session_id: session.session_id,
      command_key: `modulo-${action}-${session.session_id}-${session.revision}`,
      expected_revision: session.revision, action,
    });
    setSession(next);
  });

  const recordEscalation = () => run(async () => {
    if (!session || session.mode !== 'Exploration' || !escalationReason.trim()) return;
    const next = await intakeCall<Session>('command_intake_mode', {
      namespace, session_id: session.session_id,
      command_key: `modulo-escalation-${session.session_id}-${session.revision}`,
      expected_revision: session.revision, action: 'record',
      payload: { data: { escalation_reason: escalationReason.trim() } },
    });
    setSession(next); setEscalationReason('');
  });

  const decideSuggestion = (suggestion: RelatedSuggestion, decision: 'dismiss' | 'follow') => run(async () => {
    if (!session || session.mode !== 'Exploration') return;
    const next = await intakeCall<Session>('decide_exploration_suggestion', {
      namespace, session_id: session.session_id, suggestion_id: suggestion.suggestion_id,
      command_key: `modulo-${decision}-${session.session_id}-${suggestion.suggestion_id}`,
      expected_revision: session.revision, decision, saved: decision === 'follow',
    });
    setSession(next);
  });

  const inspectVisit = async (visit: TrailVisit) => {
    setSelectedVisit(visit); setSourceAnnotations([]); setAnnotationBody('');
    try {
      const source = visit.source_id.startsWith('feed:')
        ? await intakeCall<{ annotations: SourceAnnotation[] }>('inspect_intake_feed_item', {
            namespace, item_id: visit.source_id,
          })
        : await intakeCall<{ annotations: SourceAnnotation[] }>('inspect_exploration_source', {
            namespace, source_id: visit.source_id, version: visit.version,
          });
      setSourceAnnotations((source.annotations ?? []).filter(
        annotation => annotation.source_version === visit.version));
    } catch (cause) { setSelectedVisit(undefined); setSourceAnnotations([]);
      setError(cause instanceof Error ? cause.message : String(cause)); }
  };

  const annotateVisit = () => run(async () => {
    if (!session || !selectedVisit) return;
    const isFeed = selectedVisit.source_id.startsWith('feed:');
    const current = isFeed
      ? await intakeCall<{ source_version: number }>('inspect_intake_feed_item', {
          namespace, item_id: selectedVisit.source_id,
        })
      : await intakeCall<{ version: number }>('inspect_exploration_source', {
          namespace, source_id: selectedVisit.source_id,
        });
    const version = 'source_version' in current ? current.source_version : current.version;
    if (version !== selectedVisit.version)
      throw new Error('This source has a newer version. Open the current source before adding a note.');
    await intakeCall(isFeed ? 'annotate_intake_feed_item' : 'annotate_exploration_source', {
      namespace, ...(isFeed ? { item_id: selectedVisit.source_id } : { source_id: selectedVisit.source_id }),
      request_key: await noteKey(session.session_id, selectedVisit, annotationBody.trim()),
      body: annotationBody.trim(),
    });
    await inspectVisit(selectedVisit);
  });

  const researchVisit = (visit: TrailVisit) => run(async () => {
    if (!session || session.mode !== 'Exploration') return;
    const next = await intakeCall<Session>('start_intake_mode', {
      namespace, mode: 'Deep Research',
      request_key: `modulo-research-${session.session_id}-${visit.source_id}-${visit.version}`,
      intent: `Investigate ${visit.title}`,
      origin: { session_id: session.session_id, reason: 'Saved Exploration source selected for research' },
      references: [{ kind: visit.source_id.startsWith('feed:') ? 'intake_feed_item' : 'exploration_source',
        id: visit.source_id, namespace, version: visit.version, locator: { url: visit.url } }],
    });
    await preferences.set({ namespace, lastSessionId: next.session_id });
    setSession(next);
  });

  const decide = (item: FeedItem, decision: string) => run(async () => {
    if (session?.mode === 'Awareness' && session.status === 'active' &&
        session.inputs.feed_item_ids?.includes(item.item_id)) {
      const next = await intakeCall<Session>('triage_awareness_item', {
        namespace, session_id: session.session_id, item_id: item.item_id,
        command_key: crypto.randomUUID(), expected_revision: session.revision, decision,
      });
      setSession(next);
    } else {
      await intakeCall('decide_intake_feed_item', {
        namespace, item_id: item.item_id, command_key: crypto.randomUUID(), decision,
      });
    }
  });

  const finish = () => run(async () => {
    if (!session) return;
    const next = await intakeCall<Session>('command_intake_mode', {
      namespace, session_id: session.session_id, command_key: crypto.randomUUID(),
      expected_revision: session.revision, action: 'complete',
    });
    setSession(next);
  });

  const explore = (item: FeedItem) => run(async () => {
    if (!session || session.mode !== 'Awareness') throw new Error('Start Awareness before escalating.');
    if (!/^feed:[0-9a-f]{32}$/.test(item.item_id)) throw new Error('The feed item has an invalid identity.');
    const client = await plugins.state('information-intake');
    const linkId = `item.${item.item_id.slice(5)}`;
    const existing = client.get(linkId);
    const prior = existing?.value as { objectVersion?: number; sourceVersion?: number } | undefined;
    if (!existing) {
      await client.create(linkId, {
        id: linkId, noesisItemId: item.item_id, sourceVersion: item.source_version,
        objectVersion: 1, createdAt: new Date().toISOString(),
      }, 'modulo.intake.item-link', 1);
    } else if (existing.deleted) {
      await client.set(linkId, {
        id: linkId, noesisItemId: item.item_id, sourceVersion: item.source_version,
        objectVersion: 1, createdAt: new Date().toISOString(),
      }, 'modulo.intake.item-link', 1);
    } else if (prior?.sourceVersion !== item.source_version) {
      await client.set(linkId, {
        ...prior, id: linkId, noesisItemId: item.item_id,
        sourceVersion: item.source_version, objectVersion: (prior?.objectVersion ?? 1) + 1,
      }, 'modulo.intake.item-link', 1);
    }
    await client.synchronize();
    const stored = client.get(linkId);
    if (!stored || stored.pending || stored.conflict || stored.deleted) {
      throw new Error('Save the Modulo intake link before promoting this item.');
    }
    const version = (stored.value as { objectVersion: number }).objectVersion;
    const workspaceLink = { system: 'modulo', workspace_id: 'personal', kind: 'intake_item',
      id: linkId, version };
    const next = await intakeCall<Session>('promote_awareness_item', {
      namespace, awareness_session_id: session.session_id, item_id: item.item_id,
      request_key: `modulo-explore-${session.session_id}-${item.item_id}-${version}`,
      target_mode: 'Exploration', reason: 'Selected during feed triage', intent: `Explore ${item.title}`,
      workspace_links: [workspaceLink],
    });
    await preferences.set({ namespace, lastSessionId: next.session_id });
    setSession(next);
  });

  const previewMigration = async () => {
    setMigrationBusy(true); setMigrationError(undefined); setMigrationResult(undefined);
    setUndoResult(undefined);
    try {
      const client = await plugins.state('information-intake');
      await client.refreshAll();
      setMigration(await planLegacyIntakeMigration(
        window.localStorage.getItem(LEGACY_INTAKE_KEY), client));
    } catch (cause) {
      setMigrationError(cause instanceof Error ? cause.message : String(cause));
    } finally { setMigrationBusy(false); }
  };

  const importMigration = async () => {
    if (!migration || migration.status !== 'ready') return;
    setMigrationBusy(true); setMigrationError(undefined);
    try {
      const client = await plugins.state('information-intake');
      const current = await planLegacyIntakeMigration(
        window.localStorage.getItem(LEGACY_INTAKE_KEY), client);
      if (current.status !== 'ready' || current.sourceDigest !== migration.sourceDigest)
        throw new Error('The local or synced intake data changed. Preview the migration again.');
      const result = await importLegacyIntake(current, client);
      setMigrationResult(result);
      setMigration({ ...current, reportExists: true });
    } catch (cause) {
      setMigrationError(cause instanceof Error ? cause.message : String(cause));
    } finally { setMigrationBusy(false); }
  };

  const undoMigration = async () => {
    if (!migration?.reportExists) return;
    setMigrationBusy(true); setMigrationError(undefined);
    try {
      const client = await plugins.state('information-intake');
      await client.refreshAll();
      const current = await planLegacyIntakeMigration(
        window.localStorage.getItem(LEGACY_INTAKE_KEY), client);
      if (current.status !== 'ready' || !current.reportExists
        || current.sourceDigest !== migration.sourceDigest)
        throw new Error('The local or synced intake data changed. Preview the migration again.');
      setUndoResult(await undoLegacyIntake(current, client));
      setMigrationResult(undefined);
      setMigration({ ...current, reportExists: false });
    } catch (cause) {
      setMigrationError(cause instanceof Error ? cause.message : String(cause));
    } finally { setMigrationBusy(false); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 text-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-semibold">Information Intake</h1>
          <p className="mt-1 text-muted-foreground">Feed triage and linked Noesis sessions</p>
        </div>
        <button className={buttonClass} disabled={busy} onClick={() => void run(async () => {
          await intakeCall('refresh_intake_feed_inbox', { namespace });
        })}>Refresh feeds</button>
      </header>

      {preferences.error && <p role="alert" className="text-destructive">Plugin state: {preferences.error}</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {preflight && !preflight.available &&
        <p role="status" className="border border-border p-3">Noesis is unavailable: {preflight.reason}</p>}

      <section className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1">Namespace
          <input className="w-44 rounded-md border border-border bg-background px-2 py-1.5" value={namespaceDraft}
            onChange={event => setNamespaceDraft(event.target.value)} />
        </label>
        <button className={buttonClass} disabled={busy || !preferences.ready} onClick={() => void saveNamespace()}>Use namespace</button>
      </section>

      <section className="space-y-2 border-b border-border pb-5">
        <h2 className="font-semibold">Start with curiosity</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid min-w-64 flex-1 gap-1">What are you exploring?
            <input className="rounded-md border border-border bg-background px-2 py-1.5"
              value={curiosity} onChange={event => setCuriosity(event.target.value)}
              placeholder="Optional — no project or deliverable needed" />
          </label>
          <label className="grid gap-1">Time box
            <select className="rounded-md border border-border bg-background px-2 py-1.5"
              value={explorationMinutes} onChange={event => setExplorationMinutes(Number(event.target.value))}>
              <option value={60}>60 minutes</option>
              <option value={90}>90 minutes</option>
              <option value={120}>120 minutes</option>
            </select>
          </label>
          <button className={buttonClass} disabled={busy || preflight?.available === false}
            onClick={() => void startExploration()}>Start Exploration</button>
        </div>
      </section>

      <section className="space-y-3 border-b border-border pb-5">
        <h2 className="font-semibold">Feeds</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid min-w-64 flex-1 gap-1">Feed URL
            <input className="rounded-md border border-border bg-background px-2 py-1.5" type="url" value={feedUrl}
              onChange={event => setFeedUrl(event.target.value)} placeholder="https://example.org/feed.xml" />
          </label>
          <label className="grid min-w-44 flex-1 gap-1">Name
            <input className="rounded-md border border-border bg-background px-2 py-1.5" value={feedName}
              onChange={event => setFeedName(event.target.value)} />
          </label>
          <button className={buttonClass} disabled={busy || !feedUrl.trim()} onClick={() => void subscribe()}>Subscribe</button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Inbox {page ? `(${page.remaining_unprocessed} unprocessed)` : ''}</h2>
          <button className={buttonClass} disabled={busy || !page?.remaining_unprocessed} onClick={() => void startAwareness()}>Start daily triage</button>
        </div>
        {session && <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
          <span>{session.mode} · {session.status} · {session.duration_minutes} minute budget</span>
          <span className="font-mono text-xs text-muted-foreground">{session.session_id}</span>
          {session.mode === 'Awareness' && session.status === 'active' &&
            <button className={buttonClass} disabled={busy || !!session.unmet_completion_checks?.length}
              onClick={() => void finish()}>Finish triage</button>}
        </div>}
        {!page?.items.length && <p className="text-muted-foreground">No feed items in this namespace.</p>}
        <ul className="divide-y divide-border">
          {page?.items.map(item => <li key={item.item_id} className="space-y-2 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <a className="font-medium underline-offset-2 hover:underline" href={item.original_url}
                target="_blank" rel="noopener noreferrer">{item.title}</a>
              <span className="text-xs text-muted-foreground">Source v{item.source_version} · {item.decision ?? 'Unprocessed'}</span>
            </div>
            {!item.decision && <div className="flex flex-wrap gap-2">
              {(['discard', 'archive', 'flag', 'escalate'] as const).map(decision =>
                <button key={decision} className={buttonClass} disabled={busy}
                  onClick={() => void decide(item, decision)}>{decision[0].toUpperCase() + decision.slice(1)}</button>)}
            </div>}
            {item.decision === 'escalate' && session?.mode === 'Awareness' &&
              session.inputs.feed_item_ids?.includes(item.item_id) &&
              session.data.decisions?.[item.item_id] === 'escalate' &&
              <button className={buttonClass} disabled={busy} onClick={() => void explore(item)}>Explore this item</button>}
            {session?.mode === 'Exploration' && session.status === 'active' &&
              !session.data.trail?.some(visit => visit.source_id === item.item_id) &&
              <button className={buttonClass} disabled={busy} onClick={() => void visitFeedItem(item)}>Save to trail</button>}
          </li>)}
        </ul>
      </section>

      {session?.mode === 'Exploration' && <section className="space-y-5 border-t border-border pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Exploration trail</h2>
            <p className="text-muted-foreground">{session.status} · {Math.ceil(session.remaining_minutes ?? session.duration_minutes)} minutes remaining</p>
          </div>
          <div className="flex gap-2">
            {session.status === 'active' && <button className={buttonClass} disabled={busy}
              onClick={() => void updateExploration('pause')}>Pause</button>}
            {session.status === 'paused' && <button className={buttonClass} disabled={busy}
              onClick={() => void updateExploration('resume')}>Resume</button>}
            {session.status === 'active' && <button className={buttonClass}
              disabled={busy || !!session.unmet_completion_checks?.length}
              onClick={() => void updateExploration('complete')}>Finish Exploration</button>}
          </div>
        </div>
        {session.status === 'active' && <div className="space-y-3 border-b border-border pb-5">
          <h3 className="font-medium">Add a page</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1">Page URL
              <input className="rounded-md border border-border bg-background px-2 py-1.5" type="url"
                value={captureUrl} onChange={event => setCaptureUrl(event.target.value)} />
            </label>
            <label className="grid gap-1">Title
              <input className="rounded-md border border-border bg-background px-2 py-1.5"
                value={captureTitle} onChange={event => setCaptureTitle(event.target.value)} />
            </label>
          </div>
          <label className="grid gap-1">Your note
            <textarea className="min-h-20 rounded-md border border-border bg-background px-2 py-1.5"
              value={captureNote} onChange={event => setCaptureNote(event.target.value)} />
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2"><input type="checkbox" checked={captureSaved}
              onChange={event => setCaptureSaved(event.target.checked)} />Save</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={fetchReadable}
              onChange={event => setFetchReadable(event.target.checked)} />Fetch readable text</label>
            <button className={buttonClass} disabled={busy || !captureUrl.trim()}
              onClick={() => void capturePage()}>Add to trail</button>
          </div>
        </div>}
        <ul className="divide-y divide-border">
          {session.data.trail?.slice(-20).reverse().map((visit, index) =>
            <li key={`${visit.source_id}-${visit.version}-${index}`} className="space-y-2 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <a href={visit.url} target="_blank" rel="noopener noreferrer"
                  className="font-medium underline-offset-2 hover:underline">{visit.title}</a>
                <span className="text-xs text-muted-foreground">v{visit.version} · {visit.saved ? 'Saved' : 'Visited'}</span>
              </div>
              {visit.note && <p className="text-muted-foreground">{visit.note}</p>}
              <div className="flex flex-wrap gap-2">
                <button className={buttonClass} disabled={busy} onClick={() => void inspectVisit(visit)}>Notes</button>
                {visit.saved && <button className={buttonClass} disabled={busy}
                  onClick={() => void researchVisit(visit)}>Research this source</button>}
              </div>
            </li>)}
        </ul>
        {!session.data.trail?.length && <p className="text-muted-foreground">No pages visited yet. Finishing without a discovery is valid when the time box ends.</p>}
        {selectedVisit && !session.access_degraded && <div className="space-y-2 border-t border-border pt-4">
          <h3 className="font-medium">Notes on {selectedVisit.title} · v{selectedVisit.version}</h3>
          {sourceAnnotations.map((annotation, index) =>
            <p key={`${annotation.source_version}-${index}`} className="text-muted-foreground">{annotation.body}</p>)}
          {!sourceAnnotations.length && <p className="text-muted-foreground">No source notes yet.</p>}
          <label className="grid gap-1">Add a source note
            <textarea className="min-h-20 rounded-md border border-border bg-background px-2 py-1.5"
              value={annotationBody} onChange={event => setAnnotationBody(event.target.value)} />
          </label>
          <button className={buttonClass} disabled={busy || !annotationBody.trim()}
            onClick={() => void annotateVisit()}>Save note</button>
        </div>}
        {session.status === 'active' && <div className="space-y-2 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium">Related reading</h3>
            <button className={buttonClass} disabled={busy}
              onClick={() => setSuggestionRefresh(value => value + 1)}>Refresh suggestions</button>
          </div>
          {!suggestions.length && <p className="text-muted-foreground">No related pages in your captured sources yet.</p>}
          {suggestions.map(suggestion => <div key={suggestion.suggestion_id} className="space-y-1 py-2">
            <a href={suggestion.candidate.url} target="_blank" rel="noopener noreferrer"
              className="font-medium underline-offset-2 hover:underline">{suggestion.candidate.title}</a>
            <p className="text-xs text-muted-foreground">Shared with {suggestion.anchor.title}: {suggestion.shared_terms.join(', ')}
              {suggestion.cross_domain ? ' · Different sites' : ''}</p>
            <div className="flex gap-2">
              <button className={buttonClass} disabled={busy} onClick={() => void decideSuggestion(suggestion, 'follow')}>Follow and save</button>
              <button className={buttonClass} disabled={busy} onClick={() => void decideSuggestion(suggestion, 'dismiss')}>Dismiss</button>
            </div>
          </div>)}
        </div>}
        {session.status === 'active' && session.unmet_completion_checks?.includes('timebox_or_escalation') &&
          <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
            <label className="grid min-w-64 flex-1 gap-1">Reason to end early
              <input className="rounded-md border border-border bg-background px-2 py-1.5"
                value={escalationReason} onChange={event => setEscalationReason(event.target.value)} />
            </label>
            <button className={buttonClass} disabled={busy || !escalationReason.trim()}
              onClick={() => void recordEscalation()}>Record escalation</button>
          </div>}
      </section>}

      <section className="space-y-3 border-t border-border pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Existing Modulo intake</h2>
            <p className="text-muted-foreground">Move this browser's Information Intake records into signed-in plugin state. The local copy stays in place.</p>
          </div>
          <button className={buttonClass} disabled={migrationBusy || !preferences.ready}
            onClick={() => void previewMigration()}>Preview local intake</button>
        </div>
        {migrationError && <p role="alert" className="text-destructive">{migrationError}</p>}
        {migration?.status === 'absent' && <p role="status">No browser-local Information Intake records found on this device.</p>}
        {migration && migration.status !== 'absent' && <div className="space-y-2">
          <p>{migration.records.length} records · {migration.toCreate} to add · {migration.alreadyPresent} already present</p>
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
            {Object.entries(migration.counts).filter(([, count]) => count > 0).map(([name, count]) =>
              <div key={name} className="flex gap-1"><dt>{name}</dt><dd>{count}</dd></div>)}
          </dl>
          {migration.blockers.map(message => <p key={message} role="alert" className="text-destructive">{message}</p>)}
          {migration.warnings.map((message, index) => <p key={`${index}-${message}`} className="text-muted-foreground">{message}</p>)}
          <button className={buttonClass} disabled={migrationBusy || migration.status !== 'ready'}
            onClick={() => void importMigration()}>Import into plugin state</button>
          {migration.reportExists && <button className={buttonClass} disabled={migrationBusy}
            onClick={() => void undoMigration()}>Undo unchanged import</button>}
        </div>}
        {migrationResult && <p role="status">
          Import report {migrationResult.reportKey}: {migrationResult.confirmed} confirmed,
          {' '}{migrationResult.pending} queued, {migrationResult.conflicts} conflicts.
          {migrationResult.reportPending && ' The report is queued.'}
          {migrationResult.reportConflict && ' The report has a conflict.'}
          The browser-local copy was retained.
        </p>}
        {undoResult && <p role="status">Undo queued {undoResult.pending} deletions with {undoResult.conflicts} conflicts. The browser-local copy was retained.</p>}
      </section>
    </div>
  );
}
