import { useCallback, useEffect, useState } from 'react';
import { usePluginState } from '../usePluginState';
import { intakeCall, intakePreflight } from './noesisIntakeApi';

type FeedItem = {
  item_id: string;
  title: string;
  original_url: string;
  source_version: number;
  decision: string | null;
  read_at_ms: number | null;
};
type InboxPage = { items: FeedItem[]; remaining_unprocessed: number };
type Session = {
  session_id: string;
  mode: string;
  status: string;
  revision: number;
  duration_minutes: number;
  remaining_minutes?: number;
  inputs: { feed_item_ids?: string[] };
  data: { decisions?: Record<string, string> };
  unmet_completion_checks?: string[];
};
type Preferences = { namespace: string; lastSessionId?: string; pendingStartKey?: string };

const buttonClass = 'rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50';

export function NoesisIntakeView() {
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

  const load = useCallback(async () => {
    const readiness = await intakePreflight();
    setPreflight(readiness);
    if (!readiness.available) { setPage(undefined); return; }
    const inbox = await intakeCall<InboxPage>('list_intake_feed_inbox', { namespace, limit: 50 });
    setPage(inbox);
  }, [namespace]);

  useEffect(() => {
    if (!preferences.ready) return;
    let active = true;
    void load().catch(cause => { if (active) setError(String(cause)); });
    return () => { active = false; };
  }, [load, preferences.ready]);
  useEffect(() => setNamespaceDraft(namespace), [namespace]);
  useEffect(() => {
    const sessionId = preferences.value.lastSessionId;
    if (!preferences.ready || !sessionId) return;
    let active = true;
    void intakeCall<Session>('inspect_intake_mode', { namespace, session_id: sessionId })
      .then(current => { if (active) setSession(current); })
      .catch(cause => { if (active) setError(String(cause)); });
    return () => { active = false; };
  }, [namespace, preferences.ready, preferences.value.lastSessionId]);

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
      } catch { /* Keep the original actionable error while Noesis is unavailable. */ }
    }
    finally { setBusy(false); }
  };

  const saveNamespace = () => run(async () => {
    const next = namespaceDraft.trim();
    if (!next || next.length > 128) throw new Error('Enter a namespace of at most 128 characters.');
    await preferences.set({ namespace: next });
    setSession(undefined);
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
    const next = await intakeCall<Session>('promote_awareness_item', {
      namespace, awareness_session_id: session.session_id, item_id: item.item_id,
      request_key: `modulo-explore-${session.session_id}-${item.item_id}`,
      target_mode: 'Exploration', reason: 'Selected during feed triage', intent: `Explore ${item.title}`,
    });
    await preferences.set({ namespace, lastSessionId: next.session_id });
    setSession(next);
  });

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
              <button className={buttonClass} disabled={busy} onClick={() => void explore(item)}>Explore this item</button>}
          </li>)}
        </ul>
      </section>
    </div>
  );
}
