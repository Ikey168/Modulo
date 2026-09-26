import type { PluginStateClient, StateJson } from '../../services/pluginStateClient';

/**
 * Noesis adapters for the dedicated Knowledge plugins (#474).
 *
 * A mode is started from the plugin's own record (a reading annotation, a
 * decision, a runbook, ...) instead of a separate intake item. The link keeps
 * Modulo's identity of that record (account, plugin, collection, record) apart
 * from Noesis's identity of what it started (object kind, id, revision), so
 * either side can be revised without rewriting the other, and the record stays
 * authoritative for its own content.
 */
export const NOESIS_MODES = ['Awareness', 'Exploration', 'Deep Research', 'Decision Support', 'Problem-Solving', 'Creation',
  'Externalization', 'Internalization', 'Iteration', 'Maintenance'] as const;
export type NoesisMode = (typeof NOESIS_MODES)[number];

/** Which dedicated plugins can start which modes (issue #474, "Dedicated Modulo plugin surfaces"). */
export const MODE_PLUGINS: Readonly<Record<NoesisMode, readonly string[]>> = {
  Awareness: ['feeds-reading-inbox', 'web-watch', 'document-inbox-ocr', 'universal-inbox', 'bookmark-read-later'],
  Exploration: ['bookmark-read-later', 'web-archive-read-later', 'reading-annotations', 'notes-editor', 'canvas-board'],
  'Deep Research': ['evidence-library', 'evidence-claims', 'reading-annotations', 'citation-manager', 'notes-editor', 'canvas-board'],
  'Decision Support': ['decision-journal', 'evidence-claims', 'notes-editor', 'todo-lists'],
  'Problem-Solving': ['evidence-reproducibility', 'executable-runbooks', 'notes-editor', 'todo-lists'],
  Creation: ['notes-editor', 'writing-manuscripts', 'writing-editorial', 'writing-publishing', 'living-documents'],
  Externalization: ['personal-sops', 'executable-runbooks', 'living-documents', 'notes-editor'],
  Internalization: ['flashcards-spaced-repetition', 'learning-goals', 'skill-tree', 'education-study', 'education-assignments'],
  Iteration: ['decision-journal', 'evidence-reproducibility', 'writing-editorial', 'notes-editor'],
  Maintenance: ['workspace-briefings', 'workspace-time-machine', 'web-watch', 'reminders-notifications'],
};

export function modesForPlugin(pluginId: string): NoesisMode[] {
  return NOESIS_MODES.filter(mode => MODE_PLUGINS[mode].includes(pluginId));
}

export const LINK_SCHEMA = 'modulo.noesis.record-link';
export const LINK_NAMESPACE = 'noesis-links';

export interface ModuloRecordRef {
  issuer: string;
  subject: string;
  workspace: 'personal';
  pluginId: string;
  collection: string;
  recordId: string;
}
export interface NoesisObjectRef { kind: 'intake-session'; id: string; revision?: number }
export interface NoesisRecordLink {
  version: 1;
  modulo: ModuloRecordRef;
  mode: NoesisMode;
  /** Idempotency key sent to Noesis: a retry after a failure or restart never starts a second session. */
  requestKey: string;
  noesis?: NoesisObjectRef;
  status: 'starting' | 'active' | 'completed' | 'failed' | string;
  createdAt: string;
  updatedAt: string;
}

const SAFE = /[^A-Za-z0-9_-]/g;
export const linkKey = (ref: Pick<ModuloRecordRef, 'pluginId' | 'collection' | 'recordId'>, mode: NoesisMode) =>
  [ref.pluginId, ref.collection, ref.recordId, mode].map(part => part.replace(SAFE, '_')).join('.').slice(0, 128);

export interface NoesisRecordDeps {
  links: Pick<PluginStateClient, 'get' | 'set' | 'synchronize'>;
  call: <T extends Record<string, unknown>>(tool: string, args: Record<string, unknown>) => Promise<T>;
  namespace?: string;
  now?: () => Date;
  newKey?: () => string;
}

type Session = { session_id: string; status: string; revision?: number };

export function readLink(links: Pick<PluginStateClient, 'get'>, key: string): NoesisRecordLink | undefined {
  const view = links.get(key);
  return view && !view.deleted ? view.value as unknown as NoesisRecordLink : undefined;
}

/**
 * Start (or resume) a mode for a plugin record. The link with its request key
 * is committed before Noesis is called, so an interrupted start is retried with
 * the same key and Noesis returns the session it already created.
 */
export async function startModeFromRecord(ref: ModuloRecordRef, mode: NoesisMode, intent: string, deps: NoesisRecordDeps): Promise<NoesisRecordLink> {
  if (!modesForPlugin(ref.pluginId).includes(mode)) throw new Error(`${mode} is not offered for this plugin.`);
  const key = linkKey(ref, mode);
  const now = (deps.now ?? (() => new Date()))().toISOString();
  const existing = readLink(deps.links, key);
  if (existing?.noesis && existing.status !== 'failed') return existing;
  const link: NoesisRecordLink = existing ?? {
    version: 1, modulo: ref, mode, status: 'starting', createdAt: now, updatedAt: now,
    requestKey: `modulo-record-${(deps.newKey ?? (() => crypto.randomUUID()))()}`,
  };
  if (!existing) await deps.links.set(key, link as unknown as StateJson, LINK_SCHEMA, 1);
  try {
    const session = await deps.call<Session>('start_intake_mode', {
      // Only arguments the published intake tool accepts. The back-reference to this record is kept
      // here in Modulo until Noesis's shared-identity contract (Noesis #1580) defines one.
      namespace: deps.namespace ?? 'research', mode, request_key: link.requestKey, intent: intent.slice(0, 2000),
    });
    const started: NoesisRecordLink = { ...link, status: session.status || 'active', updatedAt: now,
      noesis: { kind: 'intake-session', id: session.session_id, revision: session.revision } };
    await deps.links.set(key, started as unknown as StateJson, LINK_SCHEMA, 1);
    return started;
  } catch (error) {
    // The request key is kept: retrying returns the same Noesis session if one was created.
    await deps.links.set(key, { ...link, status: 'failed', updatedAt: now } as unknown as StateJson, LINK_SCHEMA, 1);
    throw error;
  }
}

/** Refresh a linked session's status and revision from Noesis. */
export async function refreshLink(key: string, deps: NoesisRecordDeps): Promise<NoesisRecordLink | undefined> {
  const link = readLink(deps.links, key);
  if (!link?.noesis) return link;
  const session = await deps.call<Session>('inspect_intake_mode', { namespace: deps.namespace ?? 'research', session_id: link.noesis.id });
  if (session.status === link.status && session.revision === link.noesis.revision) return link;
  const next: NoesisRecordLink = { ...link, status: session.status, updatedAt: (deps.now ?? (() => new Date()))().toISOString(),
    noesis: { ...link.noesis, revision: session.revision } };
  await deps.links.set(key, next as unknown as StateJson, LINK_SCHEMA, 1);
  return next;
}
