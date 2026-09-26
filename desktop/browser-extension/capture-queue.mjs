const MAX_QUEUE_ITEMS = 50;
const MAX_CONTENT_CHARS = 250_000;
const MAX_TITLE_CHARS = 500;
const MAX_URL_CHARS = 4_096;
const MAX_CONTEXT_CHARS = 2_000;
const RETRY_BASE_MS = 15_000;
const RETRY_MAX_MS = 15 * 60_000;

export const CAPTURE_UNITS = Object.freeze([
  { id: 'page', label: 'Page', description: 'The active page text and provenance.' },
  { id: 'selection', label: 'Selection', description: 'Only the text you selected.' },
  { id: 'pdf', label: 'PDF', description: 'The PDF URL; Noesis fetches the source.' },
  { id: 'tabs', label: 'Selected tabs', description: 'Selected tab URLs, plus active-tab text.' },
]);

export const CAPTURE_ACTIONS = Object.freeze([
  { id: 'save-source', label: 'Save source', request: 'Store this source with provenance; do not answer.' },
  { id: 'research-page', label: 'Research page', request: 'Research this source and return cited findings.' },
  { id: 'verify-claim', label: 'Verify claim', request: 'Verify the selected claim against primary and contrary evidence.' },
  { id: 'find-original', label: 'Find original', request: 'Trace this source to the earliest authoritative original.' },
  { id: 'find-related', label: 'Find related work', request: 'Find relevant related sources and distinguish independent work.' },
  { id: 'find-counterarguments', label: 'Find counterarguments', request: 'Find credible contrary evidence and unresolved objections.' },
  { id: 'explain', label: 'Explain', request: 'Explain the source or selection with citations and visible uncertainty.' },
  { id: 'deep-research', label: 'Deep research', request: 'Run a bounded deep-research investigation with a reusable evidence package.' },
  { id: 'monitor-topic', label: 'Monitor topic', request: 'Create or update a monitor for material changes related to this source.' },
]);

const CAPTURE_UNIT_IDS = new Set(CAPTURE_UNITS.map((unit) => unit.id));
const CAPTURE_ACTION_IDS = new Set(CAPTURE_ACTIONS.map((action) => action.id));

function boundedString(value, max, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback;
}

function stableHash(value) {
  // This is a deterministic queue key, not a content-authentication hash.
  let first = 2166136261;
  let second = 5381;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second, 33) ^ code;
  }
  return `${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`;
}

export function safeCaptureUrl(value) {
  try {
    const url = new URL(String(value));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    return url.href.slice(0, MAX_URL_CHARS);
  } catch {
    return '';
  }
}

export function safeEndpointUrl(value) {
  const safe = safeCaptureUrl(value);
  if (!safe) return '';
  const url = new URL(safe);
  // Clear-text transport is only acceptable for the local Noesis service.
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname)) return '';
  return url.href.replace(/\/$/, '');
}

export function actionDefinition(id) {
  return CAPTURE_ACTIONS.find((action) => action.id === id) || CAPTURE_ACTIONS[0];
}

export function sanitizeContext(value) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const context = {};
  for (const key of ['projectId', 'areaId', 'noteId', 'taskId']) {
    const candidate = boundedString(raw[key], 160);
    if (candidate && /^[A-Za-z0-9:_-]+$/.test(candidate)) context[key] = candidate;
  }
  const question = boundedString(raw.question, MAX_CONTEXT_CHARS);
  if (question) context.question = question;
  return context;
}

function normalizeTab(tab) {
  const url = safeCaptureUrl(tab?.url);
  if (!url) return null;
  return {
    id: Number.isInteger(tab?.id) ? tab.id : undefined,
    title: boundedString(tab?.title, MAX_TITLE_CHARS) || new URL(url).hostname,
    url,
    content: boundedString(tab?.content, MAX_CONTENT_CHARS),
    selection: boundedString(tab?.selection, MAX_CONTENT_CHARS),
    active: tab?.active === true,
    incognito: tab?.incognito === true,
  };
}

export function buildCaptureDocuments({
  actionId,
  unit = 'page',
  tabs = [],
  context = {},
  language = 'en',
  browser = 'browser-extension',
  capturedAt = new Date().toISOString(),
} = {}) {
  if (!CAPTURE_ACTION_IDS.has(actionId)) throw new Error('Choose a supported Noesis action.');
  if (!CAPTURE_UNIT_IDS.has(unit)) throw new Error('Choose a supported capture unit.');
  const normalizedTabs = tabs.map(normalizeTab).filter(Boolean);
  if (!normalizedTabs.length) throw new Error('No capturable HTTP(S) tab was selected.');
  if (normalizedTabs.some((tab) => tab.incognito)) throw new Error('Private browsing tabs are never captured.');
  if (unit === 'selection' && !normalizedTabs.some((tab) => tab.selection)) throw new Error('Select text before capturing a selection.');

  const action = actionDefinition(actionId);
  const moduloContext = sanitizeContext(context);
  const isoLanguage = /^[a-z]{2}$/i.test(language) ? language.toLowerCase() : 'en';
  return normalizedTabs.map((tab) => {
    const content = unit === 'selection'
      ? tab.selection
      : unit === 'pdf'
        ? ''
        : unit === 'tabs' && !tab.active
          ? ''
          : tab.content;
    const captureKey = [action.id, unit, tab.url, content].join('\n');
    const metadata = {
      capture_unit: unit,
      capture_action: action.id,
      research_request: action.request,
      captured_at: capturedAt,
      browser,
      content_mode: content ? (unit === 'selection' ? 'selected-text' : 'visible-text') : 'url-only',
      modulo_context: moduloContext,
      modulo_return_route: 'information-intake',
    };
    if (unit === 'tabs') metadata.tab_group_size = normalizedTabs.length;
    return {
      document_id: `browser:${stableHash(captureKey)}`,
      source_type: 'web',
      language: isoLanguage,
      title: tab.title,
      content: content || null,
      content_ref: null,
      url: tab.url,
      source_id: new URL(tab.url).hostname,
      authors: [],
      created_at: null,
      metadata,
    };
  });
}

export function normalizeQueue(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object' && typeof (item.document?.document_id || item.document_id) === 'string')
    .slice(0, MAX_QUEUE_ITEMS)
    .map((item) => ({
      document: item.document && typeof item.document === 'object' ? item.document : item,
      attempts: Number.isInteger(item.attempts) && item.attempts >= 0 ? item.attempts : 0,
      lastError: boundedString(item.lastError, 500),
      nextAttemptAt: Number.isFinite(item.nextAttemptAt) ? item.nextAttemptAt : 0,
    }));
}

export function enqueue(queue, document, now = Date.now()) {
  const current = normalizeQueue(queue);
  if (current.some((item) => item.document.document_id === document.document_id)) {
    return { queue: current, added: false, reason: 'duplicate' };
  }
  if (current.length >= MAX_QUEUE_ITEMS) throw new Error('The local capture queue is full. Retry or remove an item first.');
  return {
    queue: [{ document, attempts: 0, lastError: '', nextAttemptAt: now }, ...current],
    added: true,
    reason: 'queued',
  };
}

export function markQueueFailure(queue, documentId, error, now = Date.now()) {
  return normalizeQueue(queue).map((item) => {
    if (item.document.document_id !== documentId) return item;
    const attempts = item.attempts + 1;
    const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * (2 ** Math.min(attempts - 1, 6)));
    return { ...item, attempts, lastError: boundedString(error, 500) || 'Capture delivery failed.', nextAttemptAt: now + delay };
  });
}

export function removeFromQueue(queue, documentId) {
  return normalizeQueue(queue).filter((item) => item.document.document_id !== documentId);
}

export function dueQueue(queue, now = Date.now()) {
  return normalizeQueue(queue).filter((item) => item.nextAttemptAt <= now);
}

export const queueLimits = Object.freeze({ MAX_QUEUE_ITEMS, MAX_CONTENT_CHARS, MAX_TITLE_CHARS, MAX_URL_CHARS });
