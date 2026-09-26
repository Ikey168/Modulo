import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import {
  BellRing,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  FileArchive,
  FileText,
  Image as ImageIcon,
  Library,
  Loader2,
  Plus,
  Quote,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Button, Input, Label, ScrollArea, Textarea, cn } from '@/ui';
import { LifeCollectionView } from './LifeCollectionView';
import {
  CITATION_MANAGER_PLUGIN_ID,
  FLASHCARDS_PLUGIN_ID,
  LEARNING_GOALS_PLUGIN_ID,
  LISTS_RANKINGS_PLUGIN_ID,
  MEDIA_DIARY_PLUGIN_ID,
  METADATA_RESOLVER_PLUGIN_ID,
  READING_ANNOTATIONS_PLUGIN_ID,
  READ_LATER_PLUGIN_ID,
  REMINDERS_PLUGIN_ID,
  UNIVERSAL_ATTACHMENTS_PLUGIN_ID,
  type FoundationToolDefinition,
} from './foundationTools';
import {
  bookmarkToMedia,
  lookupDoi,
  promoteAnnotationToFlashcard,
  saveMetadataToMedia,
  scheduleFlashcard,
  searchMetadata,
  type FlashcardGrade,
  type MetadataCredentials,
  type MetadataProvider,
  type MetadataResult,
} from './foundationActions';
import type { CslItem, CslStyle } from './citationEngine';
import { lifeRecordOccursOn, newLifeId, type LifeRecord } from './lifeStore';
import { useLifeCollection } from './useLifeCollection';
import { isoDate } from './planner';
import { ChoiceInline } from './viewkit';

import { desktopServices as nativeDesktop } from '@/platform';
import type { WorkspaceViewProps } from './plugins/types';
import { NoteFlashcardCapture } from './NoteFlashcardCapture';
import { SourceNoteLink } from './LearningPluginViews';
import { useLearningCollection } from './useLearningCollection';
import { useServerWorkspaceStore } from './useWorkspaceStore';
import { useMediaLibraryStore } from './usePluginDataStores';
import { dayKey } from './noteDates';
import { isWorkspaceShortcut } from './workspaceKeyboard';

/** Reminders shown in this page session; the record's Due status and log make delivery durable. */
const firedThisSession = new Set<string>();

export function FoundationToolView({ definition, workspace }: { definition: FoundationToolDefinition; workspace?: WorkspaceViewProps }) {
  const tools: Partial<Record<string, ReactNode>> = {
    [METADATA_RESOLVER_PLUGIN_ID]: <MetadataResolver definition={definition} />,
    [FLASHCARDS_PLUGIN_ID]: <>{workspace && <NoteFlashcardCapture workspace={workspace} />}<FlashcardReview definition={definition} workspace={workspace} /></>,
    [REMINDERS_PLUGIN_ID]: <ReminderControl definition={definition} />,
    [UNIVERSAL_ATTACHMENTS_PLUGIN_ID]: <AttachmentControl definition={definition} />,
    [READING_ANNOTATIONS_PLUGIN_ID]: <AnnotationActions definition={definition} />,
    [READ_LATER_PLUGIN_ID]: <ReadLaterActions definition={definition} />,
    [CITATION_MANAGER_PLUGIN_ID]: <CitationControl definition={definition} />,
    [LISTS_RANKINGS_PLUGIN_ID]: <RankingPreview definition={definition} />,
    [MEDIA_DIARY_PLUGIN_ID]: <DiaryStrip definition={definition} />,
    [LEARNING_GOALS_PLUGIN_ID]: <GoalStrip definition={definition} />,
  };
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">{tools[definition.pluginId]}<div className="flex min-h-0 flex-1"><LifeCollectionView config={definition.config} /></div></div>;
}

function ToolBand({ icon, title, children, className }: { icon: ReactNode; title: string; children: ReactNode; className?: string }) {
  return <section className={cn('shrink-0 border-b border-border bg-muted/10 px-4 py-3', className)}><div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground"><span className="[&>svg]:size-4">{icon}</span>{title}</div>{children}</section>;
}

function createRecord(definition: FoundationToolDefinition, title: string, category: string, values: Record<string, string>, update: Partial<LifeRecord> = {}): LifeRecord {
  return {
    id: newLifeId('record'), title, status: definition.config.statuses[0], category, recurrence: 'Once', favorite: false,
    tags: [], values, checklist: [], log: [], ...update,
  };
}

function MetadataResolver({ definition }: { definition: FoundationToolDefinition }) {
  const [, persist] = useLifeCollection(definition.pluginId);
  const [mediaData, persistMedia] = useMediaLibraryStore();
  const [provider, setProvider] = useState<MetadataProvider>('Open Library');
  const [query, setQuery] = useState('');
  const [credentials, setCredentials] = useState<MetadataCredentials>({});
  const [igdbCredentials, setIgdbCredentials] = useState({ clientId: '', clientSecret: '' });
  const [results, setResults] = useState<MetadataResult[]>([]);
  const [targetMediaId, setTargetMediaId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    setBusy(true); setError('');
    try {
      const desktop = nativeDesktop();
      if (desktop) {
        if (credentials.tmdbToken) await desktop.credentials.set('tmdbToken', credentials.tmdbToken);
        if (credentials.youtubeApiKey) await desktop.credentials.set('youtubeApiKey', credentials.youtubeApiKey);
        if (igdbCredentials.clientId) await desktop.credentials.set('igdbClientId', igdbCredentials.clientId);
        if (igdbCredentials.clientSecret) await desktop.credentials.set('igdbClientSecret', igdbCredentials.clientSecret);
        const batches = await Promise.all(metadataQueries(query).map((term) => desktop.providers.search(provider, term) as Promise<MetadataResult[]>));
        setResults(dedupeMetadata(batches.flat()));
      } else {
        const batches = await Promise.all(metadataQueries(query).map((term) => searchMetadata(provider, term, credentials)));
        setResults(dedupeMetadata(batches.flat()));
      }
    }
    catch (reason) { setResults([]); setError(reason instanceof Error ? reason.message : 'Metadata lookup failed.'); }
    finally { setBusy(false); }
  };
  const save = (result: MetadataResult) => {
    const nextMedia = saveMetadataToMedia(result, mediaData, targetMediaId || undefined);
    persistMedia(nextMedia.data);
    const record = createRecord(definition, result.title, result.provider, { query, externalId: result.externalId, sourceUrl: result.sourceUrl ?? '', artworkUrl: result.artworkUrl ?? '', matchedTitle: result.title, creatorYear: [result.creator, result.year].filter(Boolean).join(' · '), mediaId: nextMedia.item.id }, { status: 'Applied' });
    persist((current) => ({ ...current, records: [record, ...current.records] }));
    setResults((current) => current.filter((item) => item.externalId !== result.externalId));
    setTargetMediaId('');
  };
  return <ToolBand icon={<Search />} title="Provider lookup" className={results.length || error ? 'pb-0' : undefined}>
    <div className="flex flex-wrap gap-2">
      <ChoiceInline label="Metadata provider" value={provider} onChange={(value) => setProvider(value as MetadataProvider)} options={['Open Library', 'MusicBrainz', 'TMDB', 'YouTube', 'IGDB']} className="min-w-44" />
      <Textarea value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && !event.shiftKey && metadataQueries(query).length === 1 && void run()} placeholder={provider === 'YouTube' ? 'Title or YouTube URL · one search per line' : 'Title, creator, or external ID · one search per line'} rows={1} className="min-h-9 min-w-60 flex-1 resize-y" />
      <Button size="sm" onClick={() => void run()} disabled={busy || !query.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Search />}{metadataQueries(query).length > 1 ? `Match ${metadataQueries(query).length}` : 'Search'}</Button>
    </div>
    {provider === 'TMDB' && <SessionSecret label="TMDB read token" value={credentials.tmdbToken ?? ''} onChange={(value) => setCredentials((current) => ({ ...current, tmdbToken: value }))} />}
    {provider === 'YouTube' && <SessionSecret label="YouTube API key (URLs work without one)" value={credentials.youtubeApiKey ?? ''} onChange={(value) => setCredentials((current) => ({ ...current, youtubeApiKey: value }))} />}
    {provider === 'IGDB' && nativeDesktop() ? <><SessionSecret label="IGDB / Twitch client ID" value={igdbCredentials.clientId} onChange={(value) => setIgdbCredentials((current) => ({ ...current, clientId: value }))} /><SessionSecret label="IGDB / Twitch client secret" value={igdbCredentials.clientSecret} onChange={(value) => setIgdbCredentials((current) => ({ ...current, clientSecret: value }))} /></> : <SessionSecret label="Server-side IGDB proxy URL" value={credentials.igdbProxyUrl ?? ''} onChange={(value) => setCredentials((current) => ({ ...current, igdbProxyUrl: value }))} password={false} />}
    {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    {results.length > 0 && <><div className="mt-3 flex items-center gap-2 border-t border-border pt-2"><span className="text-xs text-muted-foreground">Conflict review</span><ChoiceInline label="Existing Media item to update" value={targetMediaId || undefined} onChange={setTargetMediaId} options={mediaData.items.map((item) => ({ value: item.id, label: `${item.title} · ${item.type}` }))} placeholder="Add as new items" clearable clearLabel="Add as new" className="min-w-64"/><span className="text-xxs text-muted-foreground">Choose a target only when this result replaces an existing entry.</span></div><ScrollArea className="mt-2 max-h-56 border-t border-border"><div className="divide-y divide-border">{results.map((result) => <div key={`${result.provider}-${result.externalId}`} className="flex items-center gap-3 py-2.5">
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">{result.artworkUrl ? <img src={result.artworkUrl} alt="" className="size-full object-cover" /> : <ImageIcon className="size-4 text-muted-foreground" />}</div>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{result.title}</p><p className="truncate text-xs text-muted-foreground">{[result.creator, result.year, result.type].filter(Boolean).join(' · ')}</p></div>
      {result.sourceUrl && <Button asChild size="icon-sm" variant="ghost"><a href={result.sourceUrl} target="_blank" rel="noreferrer" aria-label="Open provider record"><ExternalLink /></a></Button>}
      <Button size="sm" variant="outline" onClick={() => save(result)}>{targetMediaId ? <Check /> : <Plus />}{targetMediaId ? 'Apply match' : 'Add to library'}</Button>
    </div>)}</div></ScrollArea></>}
  </ToolBand>;
}

function SessionSecret({ label, value, onChange, password = true }: { label: string; value: string; onChange: (value: string) => void; password?: boolean }) {
  return <div className="mt-2 flex items-center gap-2"><Label className="w-52 shrink-0 text-xs text-muted-foreground">{label}</Label><Input type={password ? 'password' : 'url'} value={value} onChange={(event) => onChange(event.target.value)} className="h-8 max-w-xl" autoComplete="off" /><span className="text-xxs text-muted-foreground">{nativeDesktop() && password ? 'Encrypted by the OS when searched' : 'Session only'}</span></div>;
}

export function FlashcardReview({ definition, workspace }: { definition: FoundationToolDefinition; workspace?: WorkspaceViewProps }) {
  const { data, commit, error, setError } = useLearningCollection(definition.pluginId);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [deck, setDeck] = useState('All');
  const [deckLimits, setDeckLimits] = useServerWorkspaceStore<Record<string, number>>(
    'foundation-settings',
    'fsrs-deck-limits',
    'modulo.workspace.foundation.fsrs-deck-limits',
    {},
    (value) => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([key, raw]) =>
        typeof raw === 'number' && Number.isFinite(raw) ? [[key, Math.max(1, Math.min(500, Math.floor(raw)))]] : []));
    },
    'modulo-fsrs-deck-limits',
    'Flashcard deck limits',
  );
  const dailyLimit = Math.max(1, Math.min(500, Number(deckLimits[deck]) || 20));
  const today = dayKey(new Date());
  const reviewedToday = data.records.filter((record) => deck === 'All' || record.values.deck === deck)
    .reduce((count, record) => count + record.log.filter((entry) => entry.date === today && /FSRS/.test(entry.title)).length, 0);
  const remaining = Math.max(0, dailyLimit - reviewedToday);
  const decks = ['All', ...new Set(data.records.map((record) => record.values.deck).filter((name) => name && name !== 'All'))];
  const due = data.records.filter((record) => record.status !== 'Suspended' && (!record.date || record.date <= today) && (deck === 'All' || record.values.deck === deck))
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.values.lastReviewedAt || '').localeCompare(b.values.lastReviewedAt || ''))
    .slice(0, remaining);
  const card = due[0];
  const revealed = Boolean(card && revealedId === card.id);
  const grade = useCallback((value: FlashcardGrade) => {
    if (!card || !revealed) return;
    if (commit((current) => ({ ...current, records: current.records.map((item) => item.id === card.id ? scheduleFlashcard(item, value) : item) }))) setRevealedId(null);
  }, [card, commit, revealed]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (!card || !isWorkspaceShortcut(event)) return;
      if (event.code === 'Space') { event.preventDefault(); setRevealedId(card.id); }
      if (revealed && ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(event.code)) {
        event.preventDefault(); grade((['Again', 'Hard', 'Good', 'Easy'] as const)[Number(event.code.slice(-1)) - 1]);
      }
    };
    window.addEventListener('keydown', keyboard); return () => window.removeEventListener('keydown', keyboard);
  }, [card, grade, revealed]);
  const updateLimit = (value: number) => {
    const next = Math.max(1, Math.min(500, Math.floor(value) || 1));
    const limits = { ...deckLimits, [deck]: next };
    if (setDeckLimits(limits)) setError('');
    else setError('Could not queue the daily review limit for synchronization.');
  };
  return <ToolBand icon={<Brain />} title={`Review queue · ${due.length} due · ${reviewedToday}/${dailyLimit} today`}>
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <ChoiceInline label="Review deck" prefix="Deck" value={deck} onChange={(value) => { setDeck(value); setRevealedId(null); }} options={decks} className="min-w-44" />
      <Label className="text-xs text-muted-foreground" htmlFor="fsrs-daily-limit">{deck} limit</Label>
      <Input id="fsrs-daily-limit" type="number" min={1} max={500} value={dailyLimit} onChange={(event) => updateLimit(Number(event.target.value))} className="h-9 w-20" />
      <span className="text-xs text-muted-foreground">Space to reveal · 1–4 to grade</span>
    </div>
    {error && <p role="alert" className="mb-2 text-sm text-destructive">{error}</p>}
    {!card ? <p className="text-sm text-muted-foreground">{remaining === 0 ? 'Daily limit reached.' : 'Nothing is due in this deck.'}</p> : <div className="space-y-3">
      <div className="max-h-64 overflow-y-auto border-y border-border py-3">
        <p className="text-xs text-muted-foreground">{card.values.deck || card.category}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm font-medium">{card.values.front || card.title}</p>
        {revealed && <p className="mt-3 whitespace-pre-wrap border-t border-border pt-3 text-sm">{card.values.back || 'No answer yet.'}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!revealed ? <Button size="sm" onClick={() => setRevealedId(card.id)}>Show answer</Button>
          : (['Again', 'Hard', 'Good', 'Easy'] as const).map((value) => <Button key={value} size="sm" variant={value === 'Good' ? 'primary' : 'outline'} onClick={() => grade(value)}>{value}</Button>)}
        <SourceNoteLink record={card} workspace={workspace} />
      </div>
    </div>}
  </ToolBand>;
}

function ReminderControl({ definition }: { definition: FoundationToolDefinition }) {
  const [data, persist] = useLifeCollection(definition.pluginId);
  const [permission, setPermission] = useState<NotificationPermission>(() => typeof Notification === 'undefined' ? 'denied' : Notification.permission);
  const fired = useRef(new Set<string>());
  const scan = useCallback(() => {
    if (nativeDesktop()) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const now = new Date();
    const today = isoDate(now);
    for (const reminder of data.records.filter((record) => record.date && !definition.config.completedStatuses.includes(record.status) && reminderReady(record, now))) {
      const key = `${reminder.id}:${reminder.recurrence === 'Once' ? reminder.date : today}`;
      if (fired.current.has(key) || firedThisSession.has(key)) continue;
      new Notification(reminder.title, { body: reminder.values.message || reminder.notes || `Due ${reminder.date}`, tag: key });
      fired.current.add(key); firedThisSession.add(key);
      persist((current) => ({ ...current, records: current.records.map((record) => record.id === reminder.id ? { ...record, status: 'Due', log: [{ id: newLifeId('log'), date: today, title: 'Desktop notification delivered' }, ...record.log] } : record) }));
    }
  }, [data.records, definition.config.completedStatuses, persist]);
  useEffect(() => { scan(); const timer = window.setInterval(scan, 30_000); return () => window.clearInterval(timer); }, [scan]);
  useEffect(() => {
    const desktop = nativeDesktop(); if (!desktop) return;
    const reminders = data.records.filter((record) => record.date && !definition.config.completedStatuses.includes(record.status)).map((record) => ({ id: record.id, title: record.title, body: record.values.message || record.notes || 'Reminder due', dueAt: reminderDueAt(record), recurrence: record.recurrence }));
    void desktop.reminders.sync(reminders);
    return desktop.reminders.onAction(({ id, action, dueAt }) => persist((current) => ({ ...current, records: current.records.map((record) => record.id !== id ? record : action === 'done' ? record.recurrence === 'Once' ? { ...record, status: 'Done' } : { ...record, status: definition.config.statuses[0], date: dueAt?.slice(0, 10) ?? record.date } : action === 'snooze' ? { ...record, status: 'Snoozed', date: dueAt?.slice(0, 10) ?? record.date } : record) })));
  }, [data.records, definition.config.completedStatuses, definition.config.statuses, persist]);
  const due = data.records.filter((record) => record.status === 'Due').length;
  const enable = async () => { if (typeof Notification === 'undefined') return; setPermission(await Notification.requestPermission()); };
  const snooze = (id: string) => { const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); persist((current) => ({ ...current, records: current.records.map((record) => record.id === id ? { ...record, status: 'Snoozed', date: isoDate(tomorrow), log: [{ id: newLifeId('log'), date: isoDate(new Date()), title: 'Snoozed for one day' }, ...record.log] } : record) })); };
  const desktop = nativeDesktop();
  return <ToolBand icon={<BellRing />} title="Desktop delivery"><div className="flex flex-wrap items-center gap-2"><p className="min-w-0 flex-1 text-sm text-muted-foreground">{desktop ? `${data.records.length} reminders are synchronized with the native background scheduler.` : permission === 'granted' ? `${due} reminder${due === 1 ? '' : 's'} currently due. Recurring reminders are checked while Modulo is open.` : 'Enable system notifications to receive due reminders while Modulo is running.'}</p>{data.records.filter((record) => record.status === 'Due').slice(0, 3).map((record) => <Button key={record.id} size="sm" variant="ghost" onClick={() => snooze(record.id)}>Snooze “{record.title}”</Button>)}{!desktop && permission !== 'granted' && <Button size="sm" onClick={() => void enable()}><BellRing />Enable notifications</Button>}{!desktop && <Button size="sm" variant="outline" onClick={scan}>Check now</Button>}</div></ToolBand>;
}

/** Server-stored uploads (`server://`) and pre-server browser copies (`indexeddb://`, migrated on first open). */
const isStoredAttachmentLocation = (location: string): boolean =>
  location.startsWith('server://') || location.startsWith('indexeddb://');

function AttachmentControl({ definition }: { definition: FoundationToolDefinition }) {
  const [data, persist] = useLifeCollection(definition.pluginId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<{ url: string; name: string }>();
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  useEffect(() => {
    const desktop = nativeDesktop(); if (!desktop) return;
    const reconcile = async () => {
      const paths = new Set((await desktop.attachments.list()).map((file) => file.path));
      persist((current) => {
        let changed = false;
        const records = current.records.map((record) => {
          const location = record.values.location;
          if (!location || isStoredAttachmentLocation(location)) return record;
          const status = paths.has(location) ? 'Available' : 'Missing';
          if (status === record.status) return record;
          changed = true; return { ...record, status };
        });
        return changed ? { ...current, records } : current;
      });
    };
    void reconcile(); return desktop.attachments.onChanged(() => void reconcile());
  }, [persist]);
  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true); setMessage('');
    try {
      const { putAttachment } = await import('./attachmentBlobs');
      const records: LifeRecord[] = [];
      for (const file of files) {
        const id = newLifeId('record');
        await putAttachment(id, file);
        const hash = crypto.subtle ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).map((byte) => byte.toString(16).padStart(2, '0')).join('') : '';
        records.push(createRecord(definition, file.name, file.type.startsWith('image/') ? 'Image' : file.type.startsWith('audio/') ? 'Audio' : file.type.startsWith('video/') ? 'Video' : 'Document', { location: `server://${id}`, mimeType: file.type, size: formatBytes(file.size), checksum: hash, ownerPlugin: '', ownerRecord: '', source: '' }, { id, status: 'Available' }));
      }
      persist((current) => ({ ...current, records: [...records, ...current.records] }));
      const image = files.find((file) => file.type.startsWith('image/'));
      if (image) setPreview((current) => { if (current) URL.revokeObjectURL(current.url); return { url: URL.createObjectURL(image), name: image.name }; });
      setMessage(`${records.length} file${records.length === 1 ? '' : 's'} stored on the server.`);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Upload failed.'); }
    finally { setBusy(false); }
  };
  const drop = (event: DragEvent<HTMLLabelElement>) => { event.preventDefault(); void uploadFiles(Array.from(event.dataTransfer.files)); };
  const openLatest = async () => {
    const latest = data.records.find((record) => record.values.location);
    if (!latest) return;
    const desktop = nativeDesktop();
    if (desktop && !isStoredAttachmentLocation(latest.values.location)) { await desktop.attachments.open(latest.values.location); return; }
    const { attachmentUrl } = await import('./attachmentBlobs');
    const url = await attachmentUrl(latest.id);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };
  const removeLatest = async () => {
    const latest = data.records.find((record) => record.values.location); if (!latest) return;
    const desktop = nativeDesktop();
    if (desktop && !isStoredAttachmentLocation(latest.values.location)) await desktop.attachments.remove(latest.values.location);
    else { const { deleteAttachment } = await import('./attachmentBlobs'); await deleteAttachment(latest.id); }
    persist((current) => ({ ...current, records: current.records.filter((record) => record.id !== latest.id) }));
    setMessage(`Removed “${latest.title}” and its stored file.`);
  };
  const cleanMissing = () => { const count = data.records.filter((record) => record.status === 'Missing').length; persist((current) => ({ ...current, records: current.records.filter((record) => record.status !== 'Missing') })); setMessage(`Removed ${count} missing-file record${count === 1 ? '' : 's'}.`); };
  const missing = data.records.filter((record) => record.status === 'Missing').length;
  return <ToolBand icon={<FileArchive />} title="Attachment storage"><div className="flex flex-wrap items-center gap-3">{preview && <img src={preview.url} alt={`Preview of ${preview.name}`} className="size-10 rounded-md border border-border object-cover" />}<><Label onDragOver={(event) => event.preventDefault()} onDrop={drop} htmlFor="foundation-attachment-upload" className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed border-border-strong bg-background px-4 text-sm hover:bg-muted/20"><Upload className="size-4" />{busy ? 'Storing…' : 'Choose or drop files'}</Label><Input id="foundation-attachment-upload" type="file" multiple className="hidden" onChange={(event) => void uploadFiles(Array.from(event.target.files ?? []))} /></>{data.records.some((record) => record.values.location) && <><Button size="sm" variant="outline" onClick={() => void openLatest()}><ExternalLink />Open latest</Button><Button size="sm" variant="ghost" onClick={() => void removeLatest()}>Remove latest</Button></>}{missing > 0 && <Button size="sm" variant="outline" onClick={cleanMissing}>Clean {missing} missing</Button>}<p className={cn('text-xs', missing ? 'text-warning' : 'text-muted-foreground')}>{message || 'Files are stored on your Modulo server (up to 25 MB each).'}</p></div></ToolBand>;
}

function AnnotationActions({ definition }: { definition: FoundationToolDefinition }) {
  const [data, persist] = useLifeCollection(definition.pluginId);
  const [, persistFlashcards] = useLifeCollection(FLASHCARDS_PLUGIN_ID);
  const candidates = data.records.filter((record) => record.status !== 'Promoted').slice(0, 4);
  const promote = (record: LifeRecord) => {
    const card = promoteAnnotationToFlashcard(record);
    persistFlashcards((current) => ({ ...current, records: [card, ...current.records] }));
    persist((current) => ({ ...current, records: current.records.map((item) => item.id === record.id ? { ...item, status: 'Promoted' } : item) }));
  };
  return <ToolBand icon={<Quote />} title="Promote annotations"><CompactActions empty="Captured annotations can become reviewable flashcards." records={candidates} action="Make flashcard" onAction={promote} /></ToolBand>;
}

function ReadLaterActions({ definition }: { definition: FoundationToolDefinition }) {
  const [data, persist] = useLifeCollection(definition.pluginId);
  const [mediaData, persistMedia] = useMediaLibraryStore();
  const candidates = data.records.filter((record) => !record.values.mediaId && record.status !== 'Archived').slice(0, 4);
  const add = (record: LifeRecord) => {
    const nextMedia = bookmarkToMedia(record, mediaData);
    persistMedia(nextMedia.data);
    persist((current) => ({ ...current, records: current.records.map((item) => item.id === record.id ? { ...item, values: { ...item.values, mediaId: nextMedia.item.id }, status: 'Reading' } : item) }));
  };
  return <ToolBand icon={<BookOpen />} title="Reading queue handoff"><CompactActions empty="Bookmarks without a Media Library item will appear here." records={candidates} action="Add to Media" onAction={add} /></ToolBand>;
}

function CompactActions({ records, empty, action, onAction }: { records: LifeRecord[]; empty: string; action: string; onAction: (record: LifeRecord) => void }) {
  if (!records.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <div className="flex gap-2 overflow-x-auto pb-0.5">{records.map((record) => <div key={record.id} className="flex min-w-64 items-center gap-2 rounded-md border border-border bg-background px-3 py-2"><span className="min-w-0 flex-1 truncate text-sm">{record.title}</span><Button size="sm" variant="ghost" onClick={() => onAction(record)}>{action}<ChevronRight /></Button></div>)}</div>;
}

function CitationControl({ definition }: { definition: FoundationToolDefinition }) {
  const [data, persist] = useLifeCollection(definition.pluginId);
  const [doi, setDoi] = useState('');
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [style, setStyle] = useState<CslStyle>('APA');
  const [message, setMessage] = useState('');
  const addItems = async (items: CslItem[]) => {
    const { citationDuplicate, cslToRecordValues, uniqueCitationKey } = await import('./citationEngine');
    let added = 0; let duplicates = 0; let conflicts = 0;
    persist((current) => {
      const records = [...current.records];
      for (const item of items) {
        if (citationDuplicate(item, records)) { duplicates += 1; continue; }
        const converted = cslToRecordValues(item);
        const key = uniqueCitationKey(converted.values.citationKey || citationKey(converted.title, converted.values.year), records);
        if (key !== converted.values.citationKey.toLocaleLowerCase()) conflicts += 1;
        records.unshift(createRecord(definition, converted.title, converted.category, { ...converted.values, citationKey: key }, { status: 'Verified' })); added += 1;
      }
      return { ...current, records };
    });
    setDoi(''); setSource(''); setMessage(`Added ${added}; skipped ${duplicates} duplicate${duplicates === 1 ? '' : 's'}${conflicts ? `; renamed ${conflicts} conflicting key${conflicts === 1 ? '' : 's'}` : ''}.`);
  };
  const lookup = async () => { setBusy(true); setMessage(''); try { const item = await lookupDoi(doi); await addItems([{ id: citationKey(item.title || item.doi || 'source', item.year), type: 'article-journal', title: item.title, author: item.authors?.split(/,\s*/).filter(Boolean).map((literal) => ({ literal })), issued: item.year ? { 'date-parts': [[Number(item.year)]] } : undefined, 'container-title': item.container, DOI: item.doi, URL: item.url }]); } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Lookup failed.'); } finally { setBusy(false); } };
  const importText = async () => { try { const { parseCitationText } = await import('./citationEngine'); await addItems(parseCitationText(source)); } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Import failed.'); } };
  const exportAll = async (format: 'bibtex' | 'ris' | 'csl-json') => { const { exportCitations } = await import('./citationEngine'); downloadText(`modulo-citations.${format === 'bibtex' ? 'bib' : format === 'csl-json' ? 'json' : 'ris'}`, exportCitations(data.records, format)); };
  const formatAll = async () => { try { const { formatCslBibliography, lifeRecordToCsl } = await import('./citationEngine'); const formatted = formatCslBibliography(data.records, style); persist((current) => ({ ...current, records: current.records.map((record, index) => ({ ...record, values: { ...record.values, style, formatted: formatted[index] ?? '', cslJson: JSON.stringify(lifeRecordToCsl(record)) } })) })); setMessage(`Formatted ${data.records.length} citation${data.records.length === 1 ? '' : 's'} with the ${style} CSL style.`); } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Formatting failed.'); } };
  return <ToolBand icon={<FileText />} title="CSL citation workspace"><div className="grid gap-2 xl:grid-cols-[minmax(16rem,0.8fr)_minmax(20rem,1.2fr)_auto]"><div className="flex gap-2"><Input value={doi} onChange={(event) => setDoi(event.target.value)} placeholder="10.xxxx/… or doi.org URL" className="h-9" /><Button size="sm" onClick={() => void lookup()} disabled={busy || !doi.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Search />}Lookup</Button></div><div className="flex gap-2"><Textarea value={source} onChange={(event) => setSource(event.target.value)} placeholder="Paste BibTeX, RIS, or Zotero CSL JSON" rows={1} className="min-h-9 resize-none" /><Button size="sm" variant="outline" onClick={() => void importText()} disabled={!source.trim()}><Upload />Import</Button></div><div className="flex flex-wrap gap-1"><ChoiceInline label="CSL style" value={style} onChange={(value) => setStyle(value as CslStyle)} options={['APA', 'Harvard', 'Vancouver']} className="min-w-32" /><Button size="sm" variant="outline" onClick={() => void formatAll()} disabled={!data.records.length}>Format</Button><Button size="sm" variant="outline" onClick={() => void exportAll('bibtex')} disabled={!data.records.length}><Download />BibTeX</Button><Button size="sm" variant="outline" onClick={() => void exportAll('ris')} disabled={!data.records.length}>RIS</Button><Button size="sm" variant="outline" onClick={() => void exportAll('csl-json')} disabled={!data.records.length}>CSL JSON</Button></div></div>{message && <p className={cn('mt-2 text-xs', /failed|enter|found/i.test(message) ? 'text-destructive' : 'text-muted-foreground')}>{message}</p>}</ToolBand>;
}

function RankingPreview({ definition }: { definition: FoundationToolDefinition }) {
  const [data, persist] = useLifeCollection(definition.pluginId);
  const [mediaData] = useMediaLibraryStore();
  const [mediaId, setMediaId] = useState('');
  const active = data.records.find((record) => record.status === 'Active') ?? data.records[0];
  const move = (index: number, direction: -1 | 1) => {
    if (!active) return;
    const target = index + direction;
    if (target < 0 || target >= active.checklist.length) return;
    const checklist = [...active.checklist];
    [checklist[index], checklist[target]] = [checklist[target], checklist[index]];
    persist((current) => ({ ...current, records: current.records.map((record) => record.id === active.id ? { ...record, checklist } : record) }));
  };
  const addMedia = () => {
    if (!active || !mediaId) return;
    const media = mediaData.items.find((item) => item.id === mediaId);
    if (!media) return;
    const item = { id: newLifeId('check'), title: media.title, done: false };
    persist((current) => ({ ...current, records: current.records.map((record) => record.id === active.id ? { ...record, checklist: [...record.checklist, item], values: { ...record.values, [`rankMedia:${item.id}`]: media.id } } : record) }));
    setMediaId('');
  };
  return <ToolBand icon={<Library />} title="Current ranking">{!active ? <p className="text-sm text-muted-foreground">Create a list, then add ordered entries from Media Library.</p> : <div className="flex items-start gap-4"><div className="w-56 shrink-0"><p className="truncate text-sm font-medium">{active.title}</p><p className="text-xs text-muted-foreground">{active.checklist.length} ranked entries</p><div className="mt-2 flex gap-1"><ChoiceInline label="Media item to rank" value={mediaId || undefined} onChange={setMediaId} options={mediaData.items.map((item) => ({ value: item.id, label: `${item.title} · ${item.type}` }))} placeholder="Add from Media" className="min-w-40" /><Button size="icon-sm" variant="outline" onClick={addMedia} disabled={!mediaId} aria-label="Add media to ranking"><Plus /></Button></div></div><ol className="flex min-w-0 flex-1 gap-2 overflow-x-auto">{active.checklist.slice(0, 8).map((item, index) => <li key={item.id} className="flex min-w-52 items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5"><strong className="w-5 text-center text-xs tabular-nums">{index + 1}</strong><span className="min-w-0 flex-1 truncate text-xs">{item.title}</span><span className="flex"><Button size="icon-sm" variant="ghost" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${item.title} up`}><ArrowUp /></Button><Button size="icon-sm" variant="ghost" disabled={index === active.checklist.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${item.title} down`}><ArrowDown /></Button></span></li>)}</ol></div>}</ToolBand>;
}

function DiaryStrip({ definition }: { definition: FoundationToolDefinition }) {
  const [data] = useLifeCollection(definition.pluginId);
  const recent = [...data.records].filter((record) => record.date).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 4);
  return <ToolBand icon={<Sparkles />} title="Recent diary"><CompactSummary records={recent} empty="Your latest watches, reads, listens, and plays will collect here." /></ToolBand>;
}

function GoalStrip({ definition }: { definition: FoundationToolDefinition }) {
  const [data] = useLifeCollection(definition.pluginId);
  const active = data.records.filter((record) => record.status === 'Active').slice(0, 4);
  return <ToolBand icon={<Check />} title="Active outcomes"><CompactSummary records={active} empty="Activate a learning goal to keep its outcome visible here." /></ToolBand>;
}

function CompactSummary({ records, empty }: { records: LifeRecord[]; empty: string }) {
  if (!records.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <div className="flex gap-2 overflow-x-auto">{records.map((record) => <div key={record.id} className="min-w-52 rounded-md border border-border bg-background px-3 py-2"><p className="truncate text-sm font-medium">{record.title}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{record.date || record.category}</p></div>)}</div>;
}

function citationKey(title: string, year?: string): string { return `${title.split(/\s+/)[0] || 'source'}${year || ''}`.replace(/[^a-z0-9]/gi, '').toLowerCase(); }
function reminderReady(record: LifeRecord, now: Date): boolean {
  if (!record.date) return false;
  const today = isoDate(now);
  if (record.recurrence !== 'Once' && !lifeRecordOccursOn(record, today)) return false;
  const dueAt = new Date(`${record.recurrence === 'Once' ? record.date : today}T${record.values.time || '09:00'}:00`);
  const lead = /(\d+)\s*(minute|hour|day)/i.exec(record.values.leadTime || '');
  const multiplier = lead?.[2].toLowerCase() === 'day' ? 86_400_000 : lead?.[2].toLowerCase() === 'hour' ? 3_600_000 : 60_000;
  const notifyAt = dueAt.getTime() - Number(lead?.[1] || 0) * multiplier;
  return now.getTime() >= notifyAt;
}
function reminderDueAt(record: LifeRecord): string {
  const dueAt = new Date(`${record.date}T${record.values.time || '09:00'}:00`);
  const lead = /(\d+)\s*(minute|hour|day)/i.exec(record.values.leadTime || '');
  const multiplier = lead?.[2].toLowerCase() === 'day' ? 86_400_000 : lead?.[2].toLowerCase() === 'hour' ? 3_600_000 : 60_000;
  return new Date(dueAt.getTime() - Number(lead?.[1] || 0) * multiplier).toISOString();
}
function formatBytes(bytes: number): string { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 ** 2).toFixed(1)} MB`; }
function metadataQueries(value: string): string[] { return value.split(/\r?\n/).map((term) => term.trim()).filter(Boolean).slice(0, 20); }
function dedupeMetadata(results: MetadataResult[]): MetadataResult[] { const seen = new Set<string>(); return results.filter((result) => { const key = `${result.provider}:${result.externalId}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
function downloadText(name: string, content: string) { const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); }
