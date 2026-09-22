import {
  CAPTURE_ACTIONS,
  buildCaptureDocuments,
  dueQueue,
  enqueue,
  markQueueFailure,
  normalizeQueue,
  removeFromQueue,
  safeCaptureUrl,
  safeEndpointUrl,
} from './capture-queue.mjs';

const api = globalThis.browser || globalThis.chrome;
const QUEUE_KEY = 'noesisCaptureQueue';
const SETTINGS_KEY = 'noesisCaptureSettings';
const DEFAULTS = {
  endpoint: 'http://127.0.0.1:8100/api/v1/documents/ingest',
  language: 'en',
  apiKey: '',
  context: {},
};
const RETRY_ALARM = 'noesis-capture-retry';

function supportedTab(tab) {
  return Boolean(tab && safeCaptureUrl(tab.url) && !tab.incognito);
}

function isPdfUrl(value) {
  try { return new URL(safeCaptureUrl(value)).pathname.toLowerCase().endsWith('.pdf'); } catch { return false; }
}

async function readSettings() {
  const stored = await api.storage.local.get(SETTINGS_KEY);
  const value = stored?.[SETTINGS_KEY];
  return {
    ...DEFAULTS,
    ...(value && typeof value === 'object' && !Array.isArray(value) ? value : {}),
  };
}

async function writeSettings(patch) {
  const current = await readSettings();
  const next = { ...current, ...patch };
  const endpoint = safeEndpointUrl(next.endpoint);
  if (!endpoint) throw new Error('Use HTTPS for a remote Noesis endpoint, or HTTP only for localhost.');
  if (typeof next.apiKey !== 'string' || next.apiKey.length > 4096) throw new Error('The Noesis API key is too long.');
  await api.storage.local.set({ [SETTINGS_KEY]: { ...next, endpoint, apiKey: next.apiKey } });
  return next;
}

async function readQueue() {
  const stored = await api.storage.local.get(QUEUE_KEY);
  return normalizeQueue(stored?.[QUEUE_KEY]);
}

async function writeQueue(queue) {
  await api.storage.local.set({ [QUEUE_KEY]: normalizeQueue(queue) });
}

function readableError(error) {
  return error instanceof Error ? error.message : 'Noesis delivery failed.';
}

async function sendDocument(document) {
  const settings = await readSettings();
  const endpoint = safeEndpointUrl(settings.endpoint);
  if (!endpoint) throw new Error('Configure an HTTPS Noesis endpoint, or the local HTTP endpoint.');
  if (endpoint.startsWith('https://') && api.permissions?.contains && api.permissions?.request) {
    const origin = new URL(endpoint).origin;
    const allowed = await api.permissions.contains({ origins: [`${origin}/*`] });
    if (!allowed && !(await api.permissions.request({ origins: [`${origin}/*`] }))) {
      throw new Error('Allow the configured Noesis HTTPS origin before sending.');
    }
  }
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (settings.apiKey) headers['X-API-Key'] = settings.apiKey;
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(document),
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
  } catch (error) {
    throw new Error(`Noesis is unavailable: ${readableError(error)}`);
  }
  if (response.ok || response.status === 409) return { status: response.status };
  let detail = '';
  try { detail = (await response.text()).slice(0, 300); } catch { /* keep the status */ }
  throw new Error(`Noesis returned HTTP ${response.status}${detail ? `: ${detail}` : '.'}`);
}

async function deliverDocuments(documents) {
  let queue = await readQueue();
  const result = { sent: 0, queued: 0, duplicates: 0, errors: [] };
  for (const document of documents) {
    try {
      await sendDocument(document);
      result.sent += 1;
      queue = removeFromQueue(queue, document.document_id);
    } catch (error) {
      try {
        const added = enqueue(queue, document);
        queue = added.queue;
        if (!added.added) result.duplicates += 1;
        queue = markQueueFailure(queue, document.document_id, readableError(error));
        result.queued += 1;
      } catch (queueError) {
        result.errors.push(readableError(queueError));
      }
    }
  }
  await writeQueue(queue);
  return result;
}

async function flushQueue() {
  let queue = await readQueue();
  for (const item of dueQueue(queue)) {
    try {
      await sendDocument(item.document);
      queue = removeFromQueue(queue, item.document.document_id);
    } catch (error) {
      queue = markQueueFailure(queue, item.document.document_id, readableError(error));
    }
  }
  await writeQueue(queue);
  return queue.length;
}

function readPageContent(includePage, selectedText = '') {
  const selection = String(selectedText || window.getSelection?.()?.toString() || '').trim();
  const page = includePage ? String(document.body?.innerText || '').trim() : '';
  return {
    title: document.title || location.hostname,
    selection,
    content: page,
  };
}

async function contentForTab(tab, unit, activeTabId, selectionOverride = '') {
  if (!supportedTab(tab)) throw new Error('Private, browser-internal, and non-HTTP tabs are excluded.');
  if (unit === 'pdf') return { title: tab.title, content: '', selection: '' };
  const selectionOnly = unit === 'selection';
  const selected = selectionOverride || '';
  // activeTab grants temporary page access without requiring <all_urls>. For a
  // selected tab group, non-active tabs still contribute safe URL/title
  // provenance but their page text is never read implicitly.
  if (tab.id !== activeTabId) return { title: tab.title, content: '', selection: selected };
  try {
    const result = await api.scripting.executeScript({
      target: { tabId: tab.id },
      func: readPageContent,
      args: [!selectionOnly, selected],
    });
    return result?.[0]?.result || { title: tab.title, content: '', selection: selected };
  } catch (error) {
    if (selectionOverride) return { title: tab.title, content: '', selection: selectionOverride };
    throw new Error(`Could not read the selected page: ${readableError(error)}`);
  }
}

async function captureTabs({ actionId, unit, tabIds, context, language, selectionOverride, menuUrl }) {
  const activeWindow = await api.windows.getCurrent();
  const allTabs = await api.tabs.query({ windowId: activeWindow.id });
  const active = allTabs.find((tab) => tab.active) || allTabs[0];
  const requestedIds = unit === 'tabs'
    ? new Set((Array.isArray(tabIds) ? tabIds : []).map(Number))
    : new Set([active?.id]);
  let selected = allTabs.filter((tab) => requestedIds.has(tab.id));
  if (menuUrl && unit === 'pdf' && active) selected = [{ ...active, url: menuUrl, title: active.title || menuUrl }];
  if (!selected.length) throw new Error('Choose at least one tab.');
  const tabs = [];
  for (const tab of selected) {
    const page = await contentForTab(tab, unit, active?.id, tab.id === active?.id ? selectionOverride : '');
    tabs.push({ ...tab, ...page });
  }
  return buildCaptureDocuments({ actionId, unit, tabs, context, language, browser: api.runtime.getManifest().name });
}

async function currentState() {
  const settings = await readSettings();
  const activeWindow = await api.windows.getCurrent();
  const tabs = await api.tabs.query({ windowId: activeWindow.id });
  const queue = await readQueue();
  return {
    settings: { endpoint: settings.endpoint, language: settings.language, context: settings.context, hasApiKey: Boolean(settings.apiKey) },
    tabs: tabs.filter((tab) => supportedTab(tab)).map((tab) => ({ id: tab.id, title: tab.title, url: safeCaptureUrl(tab.url), active: tab.active })),
    queue: queue.map((item) => ({ documentId: item.document.document_id, title: item.document.title, url: item.document.url, attempts: item.attempts, lastError: item.lastError, nextAttemptAt: item.nextAttemptAt })),
  };
}

async function handleMessage(message) {
  if (!message || typeof message !== 'object') return { ok: false, error: 'Invalid extension request.' };
  if (message.type === 'state') return { ok: true, ...(await currentState()) };
  if (message.type === 'settings') {
    const patch = { endpoint: message.endpoint, language: message.language, context: message.context };
    if (typeof message.apiKey === 'string') patch.apiKey = message.apiKey.trim();
    const settings = await writeSettings(patch);
    return { ok: true, settings: { endpoint: settings.endpoint, language: settings.language, context: settings.context, hasApiKey: Boolean(settings.apiKey) } };
  }
  if (message.type === 'retry') return { ok: true, queued: await flushQueue() };
  if (message.type === 'capture') {
    const settings = await readSettings();
    const documents = await captureTabs({ ...message, context: message.context || settings.context, language: message.language || settings.language });
    return { ok: true, ...(await deliverDocuments(documents)) };
  }
  return { ok: false, error: 'Unsupported extension request.' };
}

function createMenus() {
  api.contextMenus.removeAll().then(() => {
    api.contextMenus.create({ id: 'noesis-capture', title: 'Send to Noesis', contexts: ['page', 'selection', 'link'] });
    for (const action of CAPTURE_ACTIONS) {
      api.contextMenus.create({ id: `noesis-action:${action.id}`, parentId: 'noesis-capture', title: action.label, contexts: ['page', 'selection', 'link'] });
    }
  });
}

api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((error) => sendResponse({ ok: false, error: readableError(error) }));
  return true;
});

api.contextMenus.onClicked.addListener((info, tab) => {
  const prefix = 'noesis-action:';
  if (typeof info.menuItemId !== 'string' || !info.menuItemId.startsWith(prefix) || !supportedTab(tab)) return;
  const actionId = info.menuItemId.slice(prefix.length);
  const unit = info.selectionText ? 'selection' : isPdfUrl(info.linkUrl) ? 'pdf' : 'page';
  void handleMessage({
    type: 'capture',
    actionId,
    unit,
    tabIds: [tab.id],
    selectionOverride: info.selectionText || '',
    menuUrl: info.linkUrl || '',
  });
});

api.runtime.onInstalled.addListener(() => { createMenus(); void api.alarms.create(RETRY_ALARM, { periodInMinutes: 5 }); });
api.runtime.onStartup.addListener(() => { createMenus(); void api.alarms.create(RETRY_ALARM, { periodInMinutes: 5 }); });
api.alarms.onAlarm.addListener((alarm) => { if (alarm.name === RETRY_ALARM) void flushQueue(); });

createMenus();
