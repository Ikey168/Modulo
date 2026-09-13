import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlugins } from '../PluginProvider';
import { usePluginState } from '../usePluginState';
import type { PluginStateClient } from '../../../../services/pluginStateClient';
import { intakeCall, intakePreflight, type IntakeReadiness } from './noesisIntakeApi';
import { NoesisDecisionView } from './NoesisDecisionView';
import { NoesisProblemView } from './NoesisProblemView';
import { NoesisPlaybookView } from './NoesisPlaybookView';
import { NoesisPracticeView } from './NoesisPracticeView';
import { NoesisCreationView } from './NoesisCreationView';
import { NoesisMaintenanceView } from './NoesisMaintenanceView';
import { NoesisIterationView } from './NoesisIterationView';
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
type SignalRule = { rule_id: string; name: string; terms: string[]; version: number };
type SignalMatch = { item_id: string; title: string;
  matched: { term: string; field: string; excerpt: string }[] };
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
  inputs: { feed_item_ids?: string[]; symptom?: string; environment?: string;
    urgency?: string; success_check?: string; research_project_id?: string };
  data: { decisions?: Record<string, string>; trail?: TrailVisit[] };
  references?: { kind: string; id: string; namespace: string; version: number;
    locator?: { url?: string; page?: number; start?: number; end?: number; section?: string } }[];
  workspace_links?: { system: 'modulo'; workspace_id: string; kind: string;
    id: string; version: number }[];
  access_degraded?: boolean;
  unmet_completion_checks?: string[];
};
type Preferences = { namespace: string; lastSessionId?: string; pendingStartKey?: string;
  pendingExploreKey?: string; pendingCaptureKey?: string };
type ResearchStartRequest = { namespace: string; request_key: string;
  questions: string[]; success_criteria: string[];
  scope: { domains: string[]; namespaces: string[] };
  budget: { requests: number; tokens: number; usd_micros: number };
  origin: { session_id: string; reason: string }; references: SourceReference[] };
type ResearchPending = { namespace: string; request?: ResearchStartRequest };
type ResearchStartResult = { project: { project_id: string; revision: number };
  session: Session };
type MigratedRecord = { key: string; collection: string; legacyId: string; title: string };

function migratedRecords(client: PluginStateClient): MigratedRecord[] {
  return client.list().flatMap(view => {
    if (view.schemaId !== 'modulo.intake.legacy-record' || view.deleted || view.pending || view.conflict ||
        !view.value || typeof view.value !== 'object' || Array.isArray(view.value)) return [];
    const { collection, legacyId, payload } = view.value;
    if (typeof collection !== 'string' || typeof legacyId !== 'string' ||
        !payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
    return [{ key: view.key, collection, legacyId,
      title: typeof payload.title === 'string' && payload.title.trim() ? payload.title : legacyId }];
  }).sort((left, right) => left.collection.localeCompare(right.collection)
    || left.legacyId.localeCompare(right.legacyId));
}

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
  const researchPending = usePluginState<ResearchPending>(
    'information-intake', 'research.pending', { namespace }, 'modulo.intake.research-start');
  const pendingResearchRequest = researchPending.value.namespace === namespace
    ? researchPending.value.request : undefined;
  const [namespaceDraft, setNamespaceDraft] = useState(namespace);
  const [preflight, setPreflight] = useState<{ available: boolean; reason?: string;
    readiness?: IntakeReadiness }>();
  const [page, setPage] = useState<InboxPage>();
  const [session, setSession] = useState<Session>();
  const [selectedInboxIds, setSelectedInboxIds] = useState<string[]>([]);
  const [batchDecision, setBatchDecision] = useState<'discard' | 'archive' | 'flag' | 'escalate'>('archive');
  const [feedUrl, setFeedUrl] = useState('');
  const [feedName, setFeedName] = useState('');
  const [feedKind, setFeedKind] = useState<'rss_atom' | 'newsletter_feed'>('rss_atom');
  const [ruleName, setRuleName] = useState('');
  const [ruleTerms, setRuleTerms] = useState('');
  const [signalRules, setSignalRules] = useState<SignalRule[]>([]);
  const [signalPreview, setSignalPreview] = useState<{ rule: SignalRule;
    matches: SignalMatch[]; evaluated_count: number; evaluation_truncated: boolean }>();
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
  const [researchSource, setResearchSource] = useState<TrailVisit>();
  const [researchQuestion, setResearchQuestion] = useState('');
  const [researchDone, setResearchDone] = useState('');
  const [researchRequests, setResearchRequests] = useState('5');
  const [researchTokens, setResearchTokens] = useState('10000');
  const [researchUsd, setResearchUsd] = useState('0');
  const [escalationReason, setEscalationReason] = useState('');
  const [migration, setMigration] = useState<LegacyIntakePlan>();
  const [migrationResult, setMigrationResult] = useState<{
    staged: number; confirmed: number; pending: number; conflicts: number;
    reportPending: boolean; reportConflict: boolean; reportKey: string;
  }>();
  const [undoResult, setUndoResult] = useState<{ pending: number; conflicts: number }>();
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [migrationError, setMigrationError] = useState<string>();
  const loadSequence = useRef(0);
  const [savedRecords, setSavedRecords] = useState<MigratedRecord[]>();
  const [savedRecordsError, setSavedRecordsError] = useState<string>();
  const [savedRecordsBusy, setSavedRecordsBusy] = useState(false);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    const readiness = await intakePreflight(namespace);
    if (sequence !== loadSequence.current) return;
    setPreflight(readiness);
    if (!readiness.available) { setPage(undefined); setSignalRules([]); setSignalPreview(undefined);
      setSession(undefined);
      setSelectedVisit(undefined); setSourceAnnotations([]); return; }
    const inbox = await intakeCall<InboxPage>('list_intake_feed_inbox', { namespace, limit: 50 });
    if (sequence !== loadSequence.current) return;
    setPage(inbox);
    const rules = await intakeCall<{ rules: SignalRule[] }>('list_intake_feed_signal_rules', { namespace });
    if (sequence !== loadSequence.current) return;
    setSignalRules(Array.isArray(rules.rules) ? rules.rules : []);
  }, [namespace]);

  useEffect(() => {
    if (!preferences.ready) return;
    let active = true;
    const sequenceRef = loadSequence;
    void load().catch(cause => { if (active) { setPage(undefined); setSignalRules([]);
      setSignalPreview(undefined); setSession(undefined); setSelectedVisit(undefined);
      setSourceAnnotations([]); setError(String(cause)); } });
    return () => { active = false; sequenceRef.current++; };
  }, [load, preferences.ready]);
  useEffect(() => setNamespaceDraft(namespace), [namespace]);
  useEffect(() => { setSelectedVisit(undefined); setSourceAnnotations([]);
    setSelectedInboxIds([]); }, [session?.session_id, namespace]);
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
        setPage(undefined); setSignalRules([]); setSignalPreview(undefined);
        setSession(undefined); setSelectedVisit(undefined); setSourceAnnotations([]);
      }
    }
    finally { setBusy(false); }
  };

  const saveNamespace = async () => {
    const next = namespaceDraft.trim();
    if (!next || next.length > 128) {
      setError('Enter a namespace of at most 128 characters.'); return;
    }
    if (next !== namespace && researchPending.value.request) {
      setError('Retry or abandon the pending research start before changing namespace.'); return;
    }
    setBusy(true); setError(undefined); loadSequence.current++;
    setPage(undefined); setSignalRules([]); setSignalPreview(undefined);
    setSession(undefined); setSelectedVisit(undefined); setSourceAnnotations([]);
    try { await preferences.set({ namespace: next }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const subscribe = () => run(async () => {
    await intakeCall('subscribe_intake_feed', {
      namespace, url: feedUrl.trim(), name: feedName.trim() || feedUrl.trim(),
      source_kind: feedKind,
    });
    setFeedUrl(''); setFeedName('');
  });

  const markRead = (item: FeedItem, read: boolean) => run(async () => {
    await intakeCall('mark_intake_feed_read', {
      namespace, item_id: item.item_id,
      command_key: crypto.randomUUID(), read,
    });
  });

  const saveSignalRule = () => run(async () => {
    const terms = ruleTerms.split(',').map(term => term.trim()).filter(Boolean);
    await intakeCall('save_intake_feed_signal_rule', {
      namespace, name: ruleName.trim(), terms,
    });
    setRuleName(''); setRuleTerms(''); setSignalPreview(undefined);
  });

  const previewSignalRule = (rule: SignalRule) => run(async () => {
    const preview = await intakeCall<{ matches: SignalMatch[];
      evaluated_count: number; evaluation_truncated: boolean }>(
      'preview_intake_feed_signal_rule', { namespace, rule_id: rule.rule_id,
        only_unprocessed: true, limit: 50 });
    setSignalPreview({ ...preview, rule });
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
      expected_revision: session.revision,
      expected_candidate_version: suggestion.candidate.reference.version,
      decision, saved: decision === 'follow',
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

  const startResearch = () => run(async () => {
    let request = pendingResearchRequest;
    if (!request) {
      if (researchPending.value.request)
        throw new Error(`Resolve the pending research start in ${researchPending.value.namespace} first.`);
      if (!session || session.mode !== 'Exploration' || !researchSource?.saved)
        throw new Error('Select a saved Exploration source before starting research.');
      const question = researchQuestion.trim();
      const criteria = researchDone.split('\n').map(line => line.trim()).filter(Boolean);
      if (!question || question.length > 2000 || !criteria.length || criteria.length > 20 ||
        criteria.some(line => line.length > 2000))
        throw new Error('Enter a question and one to twenty reviewable completion criteria.');
      const count = (value: string, label: string) => {
        if (!/^(0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(Number(value)))
          throw new Error(`${label} must be a nonnegative whole number.`);
        return Number(value);
      };
      const requests = count(researchRequests, 'Request budget');
      const tokens = count(researchTokens, 'Token budget');
      if (!requests || !tokens) throw new Error('Set positive request and token budgets.');
      if (!/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(researchUsd.trim()))
        throw new Error('Max paid spend must be a nonnegative USD amount with at most six decimals.');
      const usd_micros = Math.round(Number(researchUsd.trim()) * 1_000_000);
      if (!Number.isSafeInteger(usd_micros)) throw new Error('Max paid spend is too large.');
      request = {
        namespace, request_key: `modulo-research-${crypto.randomUUID()}`,
        questions: [question], success_criteria: criteria,
        scope: { domains: [], namespaces: [namespace] },
        budget: { requests, tokens, usd_micros },
        origin: { session_id: session.session_id,
          reason: 'Saved Exploration source selected for research' },
        references: [{ kind: researchSource.source_id.startsWith('feed:')
          ? 'intake_feed_item' : 'exploration_source',
        id: researchSource.source_id, namespace, version: researchSource.version,
        locator: { url: researchSource.url } }],
      };
      await researchPending.set({ namespace, request });
      await researchPending.retry();
    }
    const result = await intakeCall<ResearchStartResult>('start_intake_research_topic', request);
    if (!result.project?.project_id || !result.session?.session_id ||
      result.session.inputs?.research_project_id !== result.project.project_id)
      throw new Error('Noesis returned a research topic without its linked project. Retry the saved start.');
    await preferences.set({ namespace, lastSessionId: result.session.session_id });
    setSession(result.session);
    setResearchSource(undefined);
    await researchPending.set({ namespace });
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

  const triageSelected = () => run(async () => {
    if (!session || session.mode !== 'Awareness' || session.status !== 'active') return;
    const eligible = new Set(page?.items.filter(item => !item.decision &&
      session.inputs.feed_item_ids?.includes(item.item_id)).map(item => item.item_id));
    const ids = selectedInboxIds.filter(id => eligible.has(id));
    if (!ids.length) throw new Error('Select unprocessed items in the active Awareness queue.');
    const next = await intakeCall<Session>('triage_awareness_batch', {
      namespace, session_id: session.session_id,
      decisions: Object.fromEntries(ids.map(id => [id, batchDecision])),
      command_key: crypto.randomUUID(), expected_revision: session.revision,
    });
    setSession(next); setSelectedInboxIds([]);
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

  const loadSavedRecords = async () => {
    setSavedRecordsBusy(true); setSavedRecordsError(undefined);
    try {
      const client = await plugins.state('information-intake');
      await client.refreshAll();
      setSavedRecords(migratedRecords(client));
    } catch (cause) {
      setSavedRecords(undefined);
      setSavedRecordsError(cause instanceof Error ? cause.message : String(cause));
    } finally { setSavedRecordsBusy(false); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 text-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-semibold">Information Intake</h1>
          <p className="mt-1 text-muted-foreground">Feed triage, decisions, and linked Noesis sessions</p>
        </div>
        <button className={buttonClass} disabled={busy} onClick={() => void run(async () => {
          await intakeCall('refresh_intake_feed_inbox', { namespace });
        })}>Refresh feeds</button>
      </header>

      {preferences.error && <p role="alert" className="text-destructive">Plugin state: {preferences.error}</p>}
      {researchPending.value.request && <p role="status" className="border border-border p-3">
        A Deep Research topic start is pending in {researchPending.value.namespace}. Return to its Exploration source to retry the exact request.
      </p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {preflight && !preflight.available &&
        <p role="status" className="border border-border p-3">Noesis is unavailable: {preflight.reason}</p>}
      {preflight?.available && preflight.readiness && <details className="rounded-md border border-border p-3 text-sm">
        <summary className="cursor-pointer font-medium">Noesis readiness for {namespace}</summary>
        <p className="mt-2 text-xs text-muted-foreground">{preflight.readiness.enabled_feed_subscription_count} enabled feeds · Source mode: {preflight.readiness.source_mode.replace(/_/g, ' ')}. Tool access does not confirm a complete live journey.</p>
        <ul className="mt-2 space-y-1">
          {preflight.readiness.modes.map(mode => <li key={mode.mode}>
            <span className="font-medium">{mode.mode}</span> · {mode.native_start_possible ? 'Native start possible' : 'Start blocked'}
            {!mode.complete_journey_ready && <span className="text-muted-foreground"> · Full journey pending</span>}
            {mode.blockers.length > 0 && <span className="block text-xs text-muted-foreground">{mode.blockers.join('; ')}</span>}
          </li>)}
        </ul>
      </details>}

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

      <NoesisDecisionView namespace={namespace} available={preflight?.available === true}
        originSession={session} onWorkflowLinked={async next => {
          await preferences.set({ namespace, lastSessionId: next.session_id });
          setSession(await intakeCall<Session>('inspect_intake_mode', {
            namespace, session_id: next.session_id,
          }));
        }} />

      <NoesisProblemView namespace={namespace} available={preflight?.available === true}
        originSession={session} onWorkflowLinked={async next => {
          await preferences.set({ namespace, lastSessionId: next.session_id });
          setSession(await intakeCall<Session>('inspect_intake_mode', {
            namespace, session_id: next.session_id,
          }));
        }} />

      <NoesisPlaybookView namespace={namespace} available={preflight?.available === true}
        problemSession={session} />
      <NoesisPracticeView namespace={namespace} available={preflight?.available === true}
        references={session?.references ?? []} />
      <NoesisCreationView namespace={namespace} available={preflight?.available === true}
        origin={session} />
      <NoesisMaintenanceView namespace={namespace} available={preflight?.available === true}
        onSessionChanged={async next => {
          await preferences.set({ namespace, lastSessionId: next.session_id });
          setSession(next as Session);
        }} />
      <NoesisIterationView namespace={namespace} available={preflight?.available === true}
        onSessionChanged={async next => {
          await preferences.set({ namespace, lastSessionId: next.session_id });
          setSession(next as Session);
        }} />

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
          <label className="grid gap-1">Source type
            <select className="rounded-md border border-border bg-background px-2 py-1.5"
              value={feedKind} onChange={event => setFeedKind(event.target.value as 'rss_atom' | 'newsletter_feed')}>
              <option value="rss_atom">RSS or Atom</option>
              <option value="newsletter_feed">Newsletter feed</option>
            </select>
          </label>
          <button className={buttonClass} disabled={busy || !feedUrl.trim()} onClick={() => void subscribe()}>Subscribe</button>
        </div>
      </section>

      <section className="space-y-3 border-b border-border pb-5">
        <h2 className="font-semibold">Signal rules</h2>
        <p className="text-muted-foreground">Keyword previews explain matches without changing read or triage state.</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid min-w-44 flex-1 gap-1">Rule name
            <input className="rounded-md border border-border bg-background px-2 py-1.5"
              value={ruleName} onChange={event => setRuleName(event.target.value)} />
          </label>
          <label className="grid min-w-64 flex-1 gap-1">Terms, separated by commas
            <input className="rounded-md border border-border bg-background px-2 py-1.5"
              value={ruleTerms} onChange={event => setRuleTerms(event.target.value)} />
          </label>
          <button className={buttonClass} disabled={busy || !ruleName.trim() || !ruleTerms.trim()}
            onClick={() => void saveSignalRule()}>Save rule</button>
        </div>
        {signalRules.length > 0 && <ul className="divide-y divide-border">
          {signalRules.map(rule => <li key={rule.rule_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div><span className="font-medium">{rule.name}</span>
              <span className="ml-2 text-muted-foreground">v{rule.version} · {rule.terms.join(', ')}</span></div>
            <button className={buttonClass} disabled={busy}
              onClick={() => void previewSignalRule(rule)}>Preview</button>
          </li>)}
        </ul>}
        {signalPreview && <div className="space-y-2 border-t border-border pt-3">
          <h3 className="font-medium">{signalPreview.rule.name}: {signalPreview.matches.length} matches</h3>
          <p className="text-xs text-muted-foreground">Evaluated {signalPreview.evaluated_count} items
            {signalPreview.evaluation_truncated ? ' · More items remain' : ''}</p>
          {signalPreview.matches.map(match => <div key={match.item_id} className="space-y-1 py-1">
            <p>{match.title}</p>
            {match.matched.map((reason, index) => <p key={`${reason.term}-${reason.field}-${index}`}
              className="text-xs text-muted-foreground">{reason.term} in {reason.field}: {reason.excerpt}</p>)}
          </div>)}
        </div>}
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
        {session?.mode === 'Awareness' && session.status === 'active' &&
          <div className="flex flex-wrap items-center gap-2">
            <label className="grid gap-1">Selected item decision
              <select className="rounded-md border border-border bg-background px-2 py-1.5"
                value={batchDecision} onChange={event => setBatchDecision(event.target.value as typeof batchDecision)}>
                <option value="archive">Archive</option>
                <option value="discard">Discard</option>
                <option value="flag">Flag</option>
                <option value="escalate">Escalate</option>
              </select>
            </label>
            <button className={buttonClass} disabled={busy || !selectedInboxIds.length}
              onClick={() => void triageSelected()}>Apply to {selectedInboxIds.length} selected</button>
          </div>}
        {!page?.items.length && <p className="text-muted-foreground">No feed items in this namespace.</p>}
        <ul className="divide-y divide-border">
          {page?.items.map(item => <li key={item.item_id} className="space-y-2 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-center gap-2">
                {!item.decision && session?.mode === 'Awareness' && session.status === 'active' &&
                  session.inputs.feed_item_ids?.includes(item.item_id) &&
                  <input type="checkbox" aria-label={`Select ${item.title}`} disabled={busy}
                    checked={selectedInboxIds.includes(item.item_id)} onChange={event =>
                      setSelectedInboxIds(ids => event.target.checked
                        ? [...ids, item.item_id] : ids.filter(id => id !== item.item_id))} />}
                <a className="font-medium underline-offset-2 hover:underline" href={item.original_url}
                  target="_blank" rel="noopener noreferrer">{item.title}</a>
              </div>
              <span className="text-xs text-muted-foreground">Source v{item.source_version} · {item.decision ?? 'Unprocessed'}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={buttonClass} disabled={busy}
                onClick={() => void markRead(item, !item.read_at_ms)}>
                {item.read_at_ms ? 'Mark unread' : 'Mark read'}
              </button>
              {!item.decision && (['discard', 'archive', 'flag', 'escalate'] as const).map(decision =>
                <button key={decision} className={buttonClass} disabled={busy}
                  onClick={() => void decide(item, decision)}>{decision[0].toUpperCase() + decision.slice(1)}</button>)}
            </div>
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
                {visit.saved && <button className={buttonClass} disabled={busy || !!researchPending.value.request}
                  onClick={() => { setResearchSource(visit); setResearchQuestion(''); setResearchDone(''); }}>
                  Research this source</button>}
              </div>
            </li>)}
        </ul>
        {!session.data.trail?.length && <p className="text-muted-foreground">No pages visited yet. Finishing without a discovery is valid when the time box ends.</p>}
        {(researchSource || pendingResearchRequest) &&
          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="font-medium">Start a research topic</h3>
            {pendingResearchRequest ? <p role="status" className="text-sm text-muted-foreground">
              A topic start may already be committed in Noesis. Retry the saved request before starting another.
            </p> : <>
              <p className="text-sm text-muted-foreground">Source: {researchSource?.title} · Scope: {namespace}</p>
              <label className="grid gap-1">Research question
                <input className="rounded-md border border-border bg-background px-2 py-1.5"
                  value={researchQuestion} onChange={event => setResearchQuestion(event.target.value)} />
              </label>
              <label className="grid gap-1">Definition of Done
                <textarea className="min-h-20 rounded-md border border-border bg-background px-2 py-1.5"
                  placeholder="One reviewable criterion per line" value={researchDone}
                  onChange={event => setResearchDone(event.target.value)} />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1">Request budget
                  <input className="rounded-md border border-border bg-background px-2 py-1.5"
                    type="number" min="1" step="1" value={researchRequests}
                    onChange={event => setResearchRequests(event.target.value)} />
                </label>
                <label className="grid gap-1">Token budget
                  <input className="rounded-md border border-border bg-background px-2 py-1.5"
                    type="number" min="1" step="1" value={researchTokens}
                    onChange={event => setResearchTokens(event.target.value)} />
                </label>
                <label className="grid gap-1">Max paid spend (USD)
                  <input className="rounded-md border border-border bg-background px-2 py-1.5"
                    type="number" min="0" step="0.01" value={researchUsd}
                    onChange={event => setResearchUsd(event.target.value)} />
                </label>
              </div>
            </>}
            {researchPending.error && <p role="alert">Research start state: {researchPending.error}</p>}
            {researchPending.conflict && <p role="alert">Resolve the research start sync conflict before retrying.</p>}
            <div className="flex gap-2">
              <button className={buttonClass} disabled={busy || !researchPending.ready || !!researchPending.conflict}
                onClick={() => void startResearch()}>{pendingResearchRequest ? 'Retry saved topic start' : 'Start topic and project'}</button>
              {pendingResearchRequest && <button className={buttonClass} disabled={busy || !researchPending.ready}
                onClick={() => void run(async () => { await researchPending.set({ namespace }); })}>
                Abandon pending start</button>}
              {!pendingResearchRequest && <button className={buttonClass} disabled={busy}
                onClick={() => setResearchSource(undefined)}>Cancel</button>}
            </div>
          </div>}
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
            <h2 className="font-semibold">Knowledge · Research Workflow data</h2>
            <p className="text-muted-foreground">Preview this browser's Research Workflow and Information Intake records, then copy them into signed-in plugin state. The original local data stays in place.</p>
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

      <section className="space-y-3 border-t border-border pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Migrated Research Workflow records</h2>
            <p className="text-muted-foreground">Read-only records from your signed-in Modulo plugin state, including on another device.</p>
          </div>
          <button className={buttonClass} disabled={savedRecordsBusy || !preferences.ready}
            onClick={() => void loadSavedRecords()}>Load saved records</button>
        </div>
        {savedRecordsError && <p role="alert" className="text-destructive">{savedRecordsError}</p>}
        {savedRecords && <>
          <p role="status">{savedRecords.length} migrated records available.</p>
          <ul className="divide-y divide-border">
            {savedRecords.slice(0, 50).map(record => <li key={record.key} className="flex flex-wrap gap-x-3 py-2">
              <span className="text-muted-foreground">{record.collection}</span>
              <span className="font-medium">{record.title}</span>
              <span className="font-mono text-xs text-muted-foreground">{record.legacyId}</span>
            </li>)}
          </ul>
          {savedRecords.length > 50 && <p className="text-muted-foreground">Showing the first 50 records.</p>}
        </>}
      </section>
    </div>
  );
}
