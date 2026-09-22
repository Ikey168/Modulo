'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const AdmZip = require('adm-zip');
const { PDFDocument, degrees } = require('pdf-lib');
const { Notification, dialog, ipcMain, safeStorage, shell } = require('electron');

const runFile = promisify(execFile);
const CREDENTIAL_KEYS = new Set([
  'tmdbToken', 'youtubeApiKey', 'igdbClientId', 'igdbClientSecret',
  'minifluxToken', 'karakeepToken', 'paperlessToken',
  'caldavUsername', 'caldavPassword', 'ntfyToken',
]);
const cache = new Map();
const providerReservations = new Map();
const CACHE_MS = 10 * 60 * 1000;
const MAX_REMOTE_BYTES = 10 * 1024 * 1024;
const MAX_REMOTE_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

async function reserveProviderRequest(provider) {
  const interval = provider === 'MusicBrainz' ? 1100 : 150;
  const now = Date.now();
  const reserved = Math.max(now, providerReservations.get(provider) || 0);
  providerReservations.set(provider, reserved + interval);
  if (reserved > now) await new Promise((resolve) => setTimeout(resolve, reserved - now));
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2));
  fs.renameSync(temporary, file);
}
function within(root, candidate) {
  const resolvedRoot = path.resolve(root) + path.sep;
  const resolved = path.resolve(candidate);
  if (!resolved.startsWith(resolvedRoot)) throw new Error('Path escapes the Modulo data directory.');
  return resolved;
}
function nextOccurrence(value, recurrence) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || recurrence === 'Once') return null;
  if (recurrence === 'Daily') date.setDate(date.getDate() + 1);
  else if (recurrence === 'Weekly') date.setDate(date.getDate() + 7);
  else if (recurrence === 'Monthly') date.setMonth(date.getMonth() + 1);
  else if (recurrence === 'Yearly') date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
}
function encryptPayload(payload, passphrase) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  return JSON.stringify({ format: 'modulo-encrypted-sync', version: 1, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') });
}
function decryptPayload(payload, passphrase) {
  const envelope = JSON.parse(payload);
  if (envelope.format !== 'modulo-encrypted-sync' || envelope.version !== 1) throw new Error('Unsupported encrypted snapshot.');
  const key = crypto.scryptSync(passphrase, Buffer.from(envelope.salt, 'base64'), 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

function decodeXml(value = '') {
  return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
}
function xmlValue(block, names) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (match) return decodeXml(match[1]);
  }
  return '';
}
function parseFeedXml(xml, feedUrl = '') {
  const atom = /<feed(?:\s|>)/i.test(xml);
  const blocks = [...xml.matchAll(atom ? /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi : /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);
  const feedTitle = xmlValue(xml, ['channel\\s*>[\\s\\S]*?<title', 'title']);
  return blocks.slice(0, 250).map((block, index) => {
    const linkTag = block.match(/<link(?:\s[^>]*)?href=["']([^"']+)["'][^>]*>/i);
    const link = atom ? linkTag?.[1] || xmlValue(block, ['link']) : xmlValue(block, ['link']);
    return {
      externalId: xmlValue(block, ['guid', 'id']) || link || `${feedUrl}#${index}`,
      title: xmlValue(block, ['title']) || 'Untitled feed item',
      url: link,
      source: feedTitle,
      author: xmlValue(block, ['author', 'dc:creator', 'name']),
      publishedAt: xmlValue(block, ['pubDate', 'published', 'updated']),
      summary: xmlValue(block, ['description', 'summary', 'content']),
      feedUrl,
    };
  });
}
function unfoldIcs(value) { return String(value).replace(/\r?\n[ \t]/g, ''); }
function icsValue(block, key) {
  const match = unfoldIcs(block).match(new RegExp(`^${key}(?:;[^:]*)?:(.*)$`, 'mi'));
  return match ? match[1].replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').trim() : '';
}
function icsDate(value) {
  const clean = String(value || '').replace(/Z$/, '');
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/);
  if (!match) return '';
  const [, y, m, d, hh = '00', mm = '00', ss = '00'] = match;
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}${String(value).endsWith('Z') ? 'Z' : ''}`;
}
function parseIcs(value, calendarUrl = '') {
  return [...unfoldIcs(value).matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)].map((match) => ({
    remoteId: icsValue(match[1], 'UID'), title: icsValue(match[1], 'SUMMARY') || 'Untitled event',
    startsAt: icsDate(icsValue(match[1], 'DTSTART')), endsAt: icsDate(icsValue(match[1], 'DTEND')),
    location: icsValue(match[1], 'LOCATION'), description: icsValue(match[1], 'DESCRIPTION'), calendarUrl,
  })).filter((item) => item.remoteId);
}
function httpUrl(value) {
  const url = new URL(String(value || '').trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS URL.');
  if (url.username || url.password) throw new Error('URLs with embedded credentials are not allowed.');
  return url;
}
async function fetchRemote(url, init = {}, maxBytes = MAX_REMOTE_BYTES) {
  let current = httpUrl(url);
  let request = { ...init, redirect: 'manual' };
  if (!request.signal) request.signal = AbortSignal.timeout(30_000);
  for (let redirectCount = 0; ; redirectCount += 1) {
    const response = await fetch(current, request);
    if (!REDIRECT_STATUSES.has(response.status)) {
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const length = Number(response.headers.get('content-length') || 0);
      if (length > maxBytes) throw new Error('Remote content is too large to import.');
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > maxBytes) throw new Error('Remote content is too large to import.');
      return { response, text: buffer.toString('utf8'), contentType: response.headers.get('content-type') || 'application/octet-stream', finalUrl: current.toString() };
    }
    if (redirectCount >= MAX_REMOTE_REDIRECTS) throw new Error('Too many redirects while fetching remote content.');
    const location = response.headers.get('location');
    if (!location) throw new Error('Remote redirect did not include a destination.');
    current = httpUrl(new URL(location, current).toString());
    if ([301, 302, 303].includes(response.status) && !['GET', 'HEAD'].includes(String(request.method || 'GET').toUpperCase())) {
      request = { ...request, method: 'GET' };
      delete request.body;
    }
    await response.body?.cancel();
  }
}
async function fetchText(url, init = {}, maxBytes = MAX_REMOTE_BYTES) {
  return fetchRemote(url, init, maxBytes);
}
function normalizeRemoteItems(value) {
  const object = value && typeof value === 'object' ? value : {};
  const items = Array.isArray(value) ? value : object.bookmarks || object.items || object.entries || object.results || object.data || [];
  return (Array.isArray(items) ? items : []).slice(0, 500).map((raw) => {
    const item = raw && typeof raw === 'object' ? raw : {};
    return { externalId: String(item.id || item.uuid || item.url || ''), title: String(item.title || item.name || item.url || 'Untitled'), url: String(item.url || item.link || item.original_url || ''), summary: String(item.description || item.summary || item.content || ''), createdAt: String(item.created_at || item.createdAt || item.date || '') };
  }).filter((item) => item.url);
}
function fileKind(file) {
  const extension = path.extname(file).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(extension)) return 'Image';
  if (['.pdf', '.doc', '.docx', '.odt', '.txt', '.md'].includes(extension)) return 'Document';
  if (['.mp3', '.m4a', '.wav', '.flac', '.mp4', '.mkv', '.webm'].includes(extension)) return 'Media';
  if (['.zip', '.tar', '.gz', '.7z', '.rar'].includes(extension)) return 'Archive';
  return 'File';
}
function mimeFor(file) {
  const extension = path.extname(file).toLowerCase();
  return ({ '.pdf': 'application/pdf', '.txt': 'text/plain', '.md': 'text/markdown', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.tif': 'image/tiff', '.tiff': 'image/tiff' })[extension] || 'application/octet-stream';
}
async function optionalCommand(command, args) {
  try { const { stdout = '', stderr = '' } = await runFile(command, args, { timeout: 120_000, maxBuffer: 20 * 1024 * 1024 }); return { ok: true, stdout, stderr }; }
  catch (error) {
    if (error && error.code === 'ENOENT') return { ok: false, missing: true, error: `${command} is not installed on this computer.` };
    return { ok: false, error: error instanceof Error ? error.message : `${command} failed.` };
  }
}
function isWithinAny(roots, candidate) {
  const resolved = path.resolve(candidate);
  return [...roots].some((root) => resolved === path.resolve(root) || resolved.startsWith(`${path.resolve(root)}${path.sep}`));
}
function indexDirectory(root, limit = 5000) {
  const files = [];
  const pending = [root];
  while (pending.length && files.length < limit) {
    const directory = pending.shift();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const location = path.join(directory, entry.name);
      if (entry.isDirectory()) { pending.push(location); continue; }
      if (!entry.isFile()) continue;
      const stat = fs.statSync(location);
      files.push({ name: entry.name, path: location, root, size: stat.size, modifiedAt: stat.mtime.toISOString(), extension: path.extname(entry.name).slice(1), category: fileKind(location) });
      if (files.length >= limit) break;
    }
  }
  return { root, files, truncated: Boolean(pending.length) };
}
const WATCH_STATUSES = new Set(['Active', 'Changed', 'Failed', 'Paused']);
const REMINDER_RECURRENCES = new Set(['Once', 'Daily', 'Weekly', 'Monthly', 'Yearly']);
const WATCH_MATERIALITIES = new Set(['Unknown', 'Minor', 'Material']);
const MAX_WATCH_SNAPSHOT_CHARS = 200_000;
function normalizedDate(value) {
  const text = typeof value === 'string' ? value : '';
  return text && !Number.isNaN(new Date(text).getTime()) ? text : '';
}
function boundedSnapshot(value) {
  return typeof value === 'string' ? value.slice(0, MAX_WATCH_SNAPSHOT_CHARS) : '';
}
function deltaLines(value) {
  return boundedSnapshot(value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}
function buildWatchDelta(previous, current) {
  const before = deltaLines(previous);
  const after = deltaLines(current);
  if (!before.length) return { materiality: 'Unknown', summary: 'Content changed; the previous snapshot is unavailable.', addedCount: after.length, removedCount: 0, addedLines: after.slice(0, 20), removedLines: [] };
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const addedLines = [...afterSet].filter((line) => !beforeSet.has(line)).slice(0, 20);
  const removedLines = [...beforeSet].filter((line) => !afterSet.has(line)).slice(0, 20);
  const addedCount = [...afterSet].filter((line) => !beforeSet.has(line)).length;
  const removedCount = [...beforeSet].filter((line) => !afterSet.has(line)).length;
  const materiality = addedCount + removedCount >= Math.max(1, Math.ceil(Math.max(beforeSet.size, afterSet.size) * 0.1)) ? 'Material' : 'Minor';
  return {
    materiality,
    summary: `${addedCount} added, ${removedCount} removed line${addedCount + removedCount === 1 ? '' : 's'}; ${materiality.toLowerCase()} change.`,
    addedCount,
    removedCount,
    addedLines,
    removedLines,
  };
}
function normalizeWatches(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== 'object' || !String(item.id || '').trim()) return null;
    let url;
    try { url = httpUrl(item.url).toString(); } catch { return null; }
    let sourceUrl = '';
    try { sourceUrl = item.sourceUrl ? httpUrl(item.sourceUrl).toString() : ''; } catch { sourceUrl = ''; }
    const frequency = Number(item.frequencyMinutes);
    return {
      id: String(item.id).trim(), title: String(item.title || url).slice(0, 500), url,
      ...(typeof item.selector === 'string' && item.selector ? { selector: item.selector.slice(0, 500) } : {}),
      frequencyMinutes: Number.isFinite(frequency) ? Math.min(10_080, Math.max(5, frequency)) : 60,
      lastHash: typeof item.lastHash === 'string' ? item.lastHash.slice(0, 256) : '',
      previousHash: typeof item.previousHash === 'string' ? item.previousHash.slice(0, 256) : '',
      lastSnapshot: boundedSnapshot(item.lastSnapshot), previousSnapshot: boundedSnapshot(item.previousSnapshot),
      lastChecked: normalizedDate(item.lastChecked), lastChanged: normalizedDate(item.lastChanged),
      status: WATCH_STATUSES.has(item.status) ? item.status : 'Active',
      error: typeof item.error === 'string' ? item.error.slice(0, 1_000) : '',
      changeSummary: typeof item.changeSummary === 'string' ? item.changeSummary.slice(0, 500) : '',
      materiality: WATCH_MATERIALITIES.has(item.materiality) ? item.materiality : 'Unknown',
      addedLines: Array.isArray(item.addedLines) ? item.addedLines.filter((line) => typeof line === 'string').slice(0, 20).map((line) => line.slice(0, 500)) : [],
      removedLines: Array.isArray(item.removedLines) ? item.removedLines.filter((line) => typeof line === 'string').slice(0, 20).map((line) => line.slice(0, 500)) : [],
      sourceUrl,
    };
  }).filter(Boolean);
}
function normalizeReminders(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== 'object' || !String(item.id || '').trim() || !REMINDER_RECURRENCES.has(item.recurrence)) return null;
    const dueAt = normalizedDate(item.dueAt);
    if (!dueAt) return null;
    return {
      id: String(item.id).trim(), title: String(item.title || 'Modulo reminder').slice(0, 500),
      body: String(item.body || 'Reminder due').slice(0, 2_000), dueAt: new Date(dueAt).toISOString(), recurrence: item.recurrence,
      ...(normalizedDate(item.notifiedAt) ? { notifiedAt: new Date(item.notifiedAt).toISOString() } : {}),
    };
  }).filter(Boolean);
}
function managedRoots(file) {
  const value = readJson(file, []);
  return new Set(Array.isArray(value) ? value.filter((item) => typeof item === 'string').map((item) => path.resolve(item)) : []);
}
function syncPassphrase(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 4096) throw new Error('Use a passphrase between eight and 4096 characters.');
  return value;
}

function registerNativeServices({ app, getWindow }) {
  const dataDir = path.join(app.getPath('userData'), 'native');
  const attachmentDir = path.join(dataDir, 'attachments');
  const credentialFile = path.join(dataDir, 'credentials.bin');
  const reminderFile = path.join(dataDir, 'reminders.json');
  const syncSettingsFile = path.join(dataDir, 'sync.json');
  const archiveDir = path.join(dataDir, 'web-archive');
  const documentDir = path.join(dataDir, 'documents');
  const watchFile = path.join(dataDir, 'web-watches.json');
  const managedRootsFile = path.join(dataDir, 'managed-roots.json');
  const selectedPdfFiles = new Set();
  fs.mkdirSync(attachmentDir, { recursive: true });
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.mkdirSync(documentDir, { recursive: true });

  const send = (channel, value) => {
    const window = getWindow();
    if (window && !window.isDestroyed()) window.webContents.send(channel, value);
  };
  const readCredentials = () => {
    if (!safeStorage.isEncryptionAvailable()) return {};
    try {
      const value = JSON.parse(safeStorage.decryptString(fs.readFileSync(credentialFile)));
      return Object.fromEntries(Object.entries(value || {}).filter(([key, item]) => CREDENTIAL_KEYS.has(key) && typeof item === 'string' && item.length <= 8192));
    } catch { return {}; }
  };
  const writeCredentials = (credentials) => {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('OS credential encryption is unavailable.');
    fs.mkdirSync(path.dirname(credentialFile), { recursive: true });
    const temporary = `${credentialFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, safeStorage.encryptString(JSON.stringify(credentials)), { mode: 0o600 });
      fs.chmodSync(temporary, 0o600);
      fs.renameSync(temporary, credentialFile);
    } finally {
      if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
    }
  };

  ipcMain.handle('desktop:credentials:status', () => ({ available: safeStorage.isEncryptionAvailable(), configured: Object.keys(readCredentials()) }));
  ipcMain.handle('desktop:credentials:set', (_event, key, value) => {
    if (!CREDENTIAL_KEYS.has(key)) throw new Error('Unsupported credential key.');
    if (typeof value !== 'string' || value.length > 8192) throw new Error('Credential values must be strings of 8192 characters or fewer.');
    const credentials = readCredentials();
    if (value.trim()) credentials[key] = value.trim(); else delete credentials[key];
    writeCredentials(credentials);
    return { configured: Object.keys(credentials) };
  });

  ipcMain.handle('desktop:provider:search', async (_event, provider, query) => searchProvider(provider, query, readCredentials()));

  ipcMain.handle('desktop:feeds:sync', async (_event, options) => {
    const kind = options?.kind === 'Miniflux' ? 'Miniflux' : 'RSS';
    const endpoint = httpUrl(options?.url);
    if (kind === 'Miniflux') {
      const credentials = readCredentials();
      if (!credentials.minifluxToken) throw new Error('Save a Miniflux API token first.');
      if (!endpoint.pathname.includes('/v1/')) endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/v1/entries`;
      endpoint.searchParams.set('status', 'unread'); endpoint.searchParams.set('limit', '250');
      const body = await fetchJson(endpoint.toString(), { headers: { 'X-Auth-Token': credentials.minifluxToken } });
      return (body.entries || []).map((item) => ({ externalId: String(item.id), title: item.title || 'Untitled feed item', url: item.url || '', source: item.feed?.title || '', author: item.author || '', publishedAt: item.published_at || '', summary: decodeXml(item.content || ''), feedUrl: item.feed?.feed_url || '' }));
    }
    const body = await fetchText(endpoint.toString(), {}, 5 * 1024 * 1024);
    return parseFeedXml(body.text, endpoint.toString());
  });

  ipcMain.handle('desktop:archive:capture', async (_event, rawUrl) => {
    const url = httpUrl(rawUrl).toString();
    const result = await fetchText(url);
    const id = crypto.randomUUID();
    const file = within(archiveDir, path.join(archiveDir, `${id}.html`));
    const capturedAt = new Date().toISOString();
    const banner = `<!-- Saved by Modulo at ${capturedAt} from ${url} -->\n`;
    fs.writeFileSync(file, banner + result.text, 'utf8');
    return { id, title: decodeXml(result.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '') || new URL(url).hostname, originalUrl: result.finalUrl || url, localPath: file, archivedAt: capturedAt, contentHash: crypto.createHash('sha256').update(result.text).digest('hex'), mimeType: result.contentType, sourceProvider: 'Local capture' };
  });
  ipcMain.handle('desktop:archive:import', async (_event, options) => {
    const credentials = readCredentials();
    const headers = {};
    if (options?.provider === 'Karakeep' && credentials.karakeepToken) headers.Authorization = `Bearer ${credentials.karakeepToken}`;
    const response = await fetchRemote(options?.url, { headers: { Accept: 'application/json', ...headers } });
    return normalizeRemoteItems(JSON.parse(response.text));
  });
  ipcMain.handle('desktop:archive:open', (_event, file) => shell.openPath(within(archiveDir, file)));

  let watches = normalizeWatches(readJson(watchFile, []));
  const checkWatch = async (watch) => {
    try {
      const fetched = await fetchText(watch.url, {}, 5 * 1024 * 1024);
      const filtered = watch.selector ? fetched.text.split('\n').filter((line) => line.toLowerCase().includes(String(watch.selector).toLowerCase())).join('\n') : fetched.text;
      const hash = crypto.createHash('sha256').update(filtered).digest('hex');
      const changed = Boolean(watch.lastHash && watch.lastHash !== hash);
      const checkedAt = new Date().toISOString();
      const delta = changed ? buildWatchDelta(watch.lastSnapshot, filtered) : null;
      const next = {
        ...watch,
        lastHash: hash,
        lastSnapshot: boundedSnapshot(filtered),
        lastChecked: checkedAt,
        lastChanged: changed ? checkedAt : watch.lastChanged || '',
        status: changed ? 'Changed' : 'Active',
        error: '',
        sourceUrl: fetched.finalUrl || watch.url,
        ...(changed ? {
          previousHash: watch.lastHash,
          previousSnapshot: watch.lastSnapshot,
          changeSummary: delta.summary,
          materiality: delta.materiality,
          addedLines: delta.addedLines,
          removedLines: delta.removedLines,
          delta,
        } : {}),
      };
      if (changed) {
        send('desktop:webwatch:changed', next);
        if (Notification.isSupported()) new Notification({ title: 'Web page changed', body: watch.title || watch.url }).show();
      }
      return next;
    } catch (error) { return { ...watch, status: 'Failed', lastChecked: new Date().toISOString(), error: error instanceof Error ? error.message : 'Check failed.' }; }
  };
  const checkWatches = async (ids) => {
    const targetIds = Array.isArray(ids) ? new Set(ids) : null;
    watches = await Promise.all(watches.map((watch) => !targetIds || targetIds.has(watch.id) ? checkWatch(watch) : watch));
    writeJson(watchFile, watches); return targetIds ? watches.filter((watch) => targetIds.has(watch.id)) : watches;
  };
  ipcMain.handle('desktop:webwatch:sync', (_event, items) => {
    const incoming = normalizeWatches(items);
    const existing = new Map(watches.map((watch) => [watch.id, watch]));
    watches = incoming.map((watch) => {
      const previous = existing.get(watch.id);
      if (!previous) return watch;
      return {
        ...previous,
        ...watch,
        lastSnapshot: watch.lastSnapshot || previous.lastSnapshot,
        previousSnapshot: watch.previousSnapshot || previous.previousSnapshot,
        previousHash: watch.previousHash || previous.previousHash,
        changeSummary: watch.changeSummary || previous.changeSummary,
        materiality: watch.materiality === 'Unknown' ? previous.materiality : watch.materiality,
        addedLines: watch.addedLines.length ? watch.addedLines : previous.addedLines,
        removedLines: watch.removedLines.length ? watch.removedLines : previous.removedLines,
        sourceUrl: watch.sourceUrl || previous.sourceUrl,
      };
    });
    writeJson(watchFile, watches); return watches.length;
  });
  ipcMain.handle('desktop:webwatch:check', (_event, ids) => checkWatches(ids));
  const watchTimer = setInterval(() => {
    const due = watches.filter((watch) => watch.status !== 'Paused' && (!watch.lastChecked || Date.now() - new Date(watch.lastChecked).getTime() >= Number(watch.frequencyMinutes || 60) * 60_000)).map((watch) => watch.id);
    if (due.length) void checkWatches(due);
  }, 60_000); watchTimer.unref();

  ipcMain.handle('desktop:documents:import', async () => {
    const result = await dialog.showOpenDialog(getWindow() || undefined, { title: 'Add documents', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Documents', extensions: ['pdf', 'txt', 'md', 'png', 'jpg', 'jpeg', 'tif', 'tiff'] }] });
    if (result.canceled) return [];
    const records = [];
    for (const source of result.filePaths) {
      const id = crypto.randomUUID(); const target = within(documentDir, path.join(documentDir, `${id}${path.extname(source).toLowerCase()}`));
      fs.copyFileSync(source, target); const stat = fs.statSync(target); let ocrText = ''; let ocrAvailable = true;
      const extension = path.extname(target).toLowerCase();
      if (['.txt', '.md'].includes(extension)) ocrText = fs.readFileSync(target, 'utf8').slice(0, 2_000_000);
      else if (extension === '.pdf') { const extracted = await optionalCommand('pdftotext', [target, '-']); ocrAvailable = extracted.ok; ocrText = extracted.ok ? extracted.stdout.slice(0, 2_000_000) : ''; }
      else { const extracted = await optionalCommand('tesseract', [target, 'stdout']); ocrAvailable = extracted.ok; ocrText = extracted.ok ? extracted.stdout.slice(0, 2_000_000) : ''; }
      records.push({ id, title: path.basename(source), location: target, mimeType: mimeFor(target), size: stat.size, checksum: crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'), ocrText, ocrAvailable });
    }
    return records;
  });
  ipcMain.handle('desktop:documents:open', (_event, file) => shell.openPath(within(documentDir, file)));

  ipcMain.handle('desktop:pdf:choose', async () => {
    const result = await dialog.showOpenDialog(getWindow() || undefined, { title: 'Choose PDF files', properties: ['openFile', 'multiSelections'], filters: [{ name: 'PDF documents', extensions: ['pdf'] }] });
    if (result.canceled) return [];
    result.filePaths.forEach((file) => selectedPdfFiles.add(path.resolve(file)));
    return result.filePaths;
  });
  ipcMain.handle('desktop:pdf:run', async (_event, operation, rawFiles) => {
    const files = (Array.isArray(rawFiles) ? rawFiles : []).map((file) => path.resolve(file));
    if (!files.length || files.some((file) => !selectedPdfFiles.has(file) || !fs.existsSync(file))) throw new Error('Choose the source PDF files again.');
    const extension = operation === 'Extract text' ? 'txt' : 'pdf';
    const save = await dialog.showSaveDialog(getWindow() || undefined, { title: operation, defaultPath: `modulo-${String(operation).toLowerCase().replace(/\s+/g, '-')}.${extension}`, filters: [{ name: extension === 'pdf' ? 'PDF document' : 'Text file', extensions: [extension] }] });
    if (save.canceled || !save.filePath) return null;
    let outputPath = save.filePath; let details = `${operation} completed locally.`;
    if (operation === 'Merge') {
      const output = await PDFDocument.create();
      for (const file of files) { const source = await PDFDocument.load(fs.readFileSync(file)); const pages = await output.copyPages(source, source.getPageIndices()); pages.forEach((page) => output.addPage(page)); }
      fs.writeFileSync(save.filePath, await output.save()); details = `${files.length} documents merged into ${output.getPageCount()} pages.`;
    } else if (operation === 'Split') {
      const source = await PDFDocument.load(fs.readFileSync(files[0])); const stem = save.filePath.replace(/\.pdf$/i, '');
      for (const [index] of source.getPages().entries()) { const output = await PDFDocument.create(); const [page] = await output.copyPages(source, [index]); output.addPage(page); fs.writeFileSync(`${stem}-${index + 1}.pdf`, await output.save()); }
      outputPath = `${stem}-1…${source.getPageCount()}.pdf`; details = `${source.getPageCount()} single-page PDFs created.`;
    } else if (operation === 'Rotate') {
      const output = await PDFDocument.load(fs.readFileSync(files[0])); output.getPages().forEach((page) => page.setRotation(degrees((page.getRotation().angle + 90) % 360))); fs.writeFileSync(save.filePath, await output.save()); details = `${output.getPageCount()} pages rotated clockwise.`;
    } else if (operation === 'Extract text') {
      const result = await optionalCommand('pdftotext', [files[0], save.filePath]); if (!result.ok) throw new Error(result.error); details = result.stderr || details;
    } else throw new Error('Unsupported PDF operation.');
    return { outputPath, details };
  });

  ipcMain.handle('desktop:files:choose-root', async () => {
    const result = await dialog.showOpenDialog(getWindow() || undefined, { title: 'Choose managed folder', properties: ['openDirectory'] });
    if (result.canceled || !result.filePaths[0]) return null;
    const roots = managedRoots(managedRootsFile); roots.add(path.resolve(result.filePaths[0])); writeJson(managedRootsFile, [...roots]); return result.filePaths[0];
  });
  ipcMain.handle('desktop:files:index', (_event, root) => {
    const roots = managedRoots(managedRootsFile);
    if (!roots.has(path.resolve(root)) || !fs.statSync(root).isDirectory()) throw new Error('Choose this folder before indexing it.');
    return indexDirectory(path.resolve(root));
  });
  ipcMain.handle('desktop:files:open', (_event, file) => {
    const roots = managedRoots(managedRootsFile); if (!isWithinAny(roots, file)) throw new Error('File is outside managed folders.'); return shell.openPath(path.resolve(file));
  });

  ipcMain.handle('desktop:caldav:sync', async (_event, calendarUrl) => {
    const credentials = readCredentials();
    if (!credentials.caldavUsername || !credentials.caldavPassword) throw new Error('Save CalDAV credentials first.');
    const authorization = `Basic ${Buffer.from(`${credentials.caldavUsername}:${credentials.caldavPassword}`).toString('base64')}`;
    const query = '<?xml version="1.0" encoding="utf-8"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"/></c:comp-filter></c:filter></c:calendar-query>';
    const response = await fetchRemote(calendarUrl, { method: 'REPORT', headers: { Authorization: authorization, Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' }, body: query });
    const xml = response.text;
    const data = [...xml.matchAll(/<(?:[^:>]+:)?calendar-data[^>]*>([\s\S]*?)<\/(?:[^:>]+:)?calendar-data>/gi)].flatMap((match) => parseIcs(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#13;/g, '\r'), String(calendarUrl)));
    return data;
  });

  ipcMain.handle('desktop:ntfy:publish', async (_event, options) => {
    const endpoint = httpUrl(options?.endpoint); endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/${encodeURIComponent(String(options?.topic || '').trim())}`;
    if (!String(options?.topic || '').trim()) throw new Error('Enter an ntfy topic.');
    const credentials = readCredentials();
    const response = await fetchRemote(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(credentials.ntfyToken ? { Authorization: `Bearer ${credentials.ntfyToken}` } : {}) }, body: JSON.stringify({ topic: options.topic, title: options.title || 'Modulo', message: options.message || 'Test notification', priority: options.priority || 'default', tags: options.tags || undefined, click: options.clickUrl || undefined }) });
    try { return JSON.parse(response.text); } catch { return { id: '', time: Math.floor(Date.now() / 1000) }; }
  });

  ipcMain.handle('desktop:attachments:choose', async () => {
    const window = getWindow();
    const result = await dialog.showOpenDialog(window || undefined, { title: 'Add attachments', properties: ['openFile', 'multiSelections'] });
    if (result.canceled) return [];
    const records = [];
    for (const source of result.filePaths) {
      const id = crypto.randomUUID();
      const extension = path.extname(source).slice(0, 16);
      const target = within(attachmentDir, path.join(attachmentDir, `${id}${extension}`));
      fs.copyFileSync(source, target);
      const stat = fs.statSync(target);
      records.push({ id, name: path.basename(source), path: target, size: stat.size, modifiedAt: stat.mtime.toISOString(), checksum: crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex') });
    }
    send('desktop:attachments:changed', { kind: 'added', records });
    return records;
  });
  ipcMain.handle('desktop:attachments:list', () => fs.readdirSync(attachmentDir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => {
    const file = within(attachmentDir, path.join(attachmentDir, entry.name)); const stat = fs.statSync(file);
    return { id: path.parse(entry.name).name, name: entry.name, path: file, size: stat.size, modifiedAt: stat.mtime.toISOString() };
  }));
  ipcMain.handle('desktop:attachments:open', async (_event, file) => shell.openPath(within(attachmentDir, file)));
  ipcMain.handle('desktop:attachments:remove', (_event, file) => { fs.rmSync(within(attachmentDir, file), { force: true }); send('desktop:attachments:changed', { kind: 'removed', path: file }); return true; });
  fs.watch(attachmentDir, { persistent: false }, (_event, filename) => send('desktop:attachments:changed', { kind: 'filesystem', filename }));

  let reminders = normalizeReminders(readJson(reminderFile, []));
  ipcMain.handle('desktop:reminders:sync', (_event, value) => { reminders = normalizeReminders(value); writeJson(reminderFile, reminders); return reminders.length; });
  ipcMain.handle('desktop:reminders:action', (_event, id, action) => handleReminderAction(id, action));
  function handleReminderAction(id, action) {
    if (!['done', 'snooze', 'open'].includes(action)) return false;
    const reminder = reminders.find((item) => item.id === id);
    if (!reminder) return false;
    if (action === 'snooze') { reminder.dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); delete reminder.notifiedAt; }
    else if (action === 'done' && reminder.recurrence === 'Once') reminders = reminders.filter((item) => item.id !== id);
    writeJson(reminderFile, reminders);
    send('desktop:reminder-action', { id, action, dueAt: reminder.dueAt });
    const window = getWindow(); if (action === 'open' && window) { window.show(); window.focus(); }
    return true;
  }
  const tick = () => {
    const now = Date.now();
    for (const reminder of reminders) {
      if (reminder.notifiedAt || !reminder.dueAt || new Date(reminder.dueAt).getTime() > now) continue;
      if (!Notification.isSupported()) continue;
      const notification = new Notification({ title: reminder.title || 'Modulo reminder', body: reminder.body || 'Reminder due', silent: false, actions: [{ type: 'button', text: 'Done' }, { type: 'button', text: 'Snooze 1 day' }, { type: 'button', text: 'Open' }] });
      notification.on('click', () => handleReminderAction(reminder.id, 'open'));
      notification.on('action', (_event, index) => handleReminderAction(reminder.id, index === 0 ? 'done' : index === 1 ? 'snooze' : 'open'));
      notification.show();
      const next = nextOccurrence(reminder.dueAt, reminder.recurrence);
      if (next) reminder.dueAt = next; else reminder.notifiedAt = new Date().toISOString();
    }
    writeJson(reminderFile, reminders);
  };
  const reminderTimer = setInterval(tick, 30_000); reminderTimer.unref(); tick();

  ipcMain.handle('desktop:backup:export', async (_event, payload) => {
    const result = await dialog.showSaveDialog(getWindow() || undefined, { title: 'Export Modulo backup', defaultPath: `modulo-backup-${new Date().toISOString().slice(0, 10)}.zip`, filters: [{ name: 'ZIP archive', extensions: ['zip'] }] });
    if (result.canceled || !result.filePath) return null;
    const zip = new AdmZip();
    zip.addFile('modulo-backup.json', Buffer.from(String(payload), 'utf8'));
    for (const entry of fs.readdirSync(attachmentDir, { withFileTypes: true }).filter((item) => item.isFile())) zip.addLocalFile(path.join(attachmentDir, entry.name), 'attachments');
    zip.writeZip(result.filePath);
    return result.filePath;
  });
  ipcMain.handle('desktop:backup:import', async () => {
    const result = await dialog.showOpenDialog(getWindow() || undefined, { title: 'Import Modulo backup', properties: ['openFile'], filters: [{ name: 'ZIP archive', extensions: ['zip'] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    const zip = new AdmZip(result.filePaths[0]);
    const manifest = zip.getEntry('modulo-backup.json');
    if (!manifest) throw new Error('Backup manifest is missing.');
    for (const entry of zip.getEntries().filter((item) => !item.isDirectory && item.entryName.startsWith('attachments/'))) {
      const name = path.basename(entry.entryName); if (!name || name !== entry.entryName.slice('attachments/'.length)) continue;
      fs.writeFileSync(within(attachmentDir, path.join(attachmentDir, name)), entry.getData());
    }
    let payload = manifest.getData().toString('utf8');
    try {
      const backup = JSON.parse(payload);
      const attachmentStore = backup?.stores?.['modulo-life-universal-attachments-v1'];
      if (Array.isArray(attachmentStore?.records)) {
        for (const record of attachmentStore.records) {
          const oldLocation = record?.values?.location;
          if (typeof oldLocation !== 'string' || oldLocation.startsWith('indexeddb://')) continue;
          const restored = path.join(attachmentDir, path.basename(oldLocation));
          if (fs.existsSync(restored)) record.values.location = restored;
        }
        payload = JSON.stringify(backup);
      }
    } catch { /* The renderer validates the manifest and reports malformed backups. */ }
    return { payload, attachments: zip.getEntries().filter((item) => item.entryName.startsWith('attachments/') && !item.isDirectory).length };
  });
  ipcMain.handle('desktop:sync:choose-directory', async () => {
    const result = await dialog.showOpenDialog(getWindow() || undefined, { title: 'Choose encrypted sync folder', properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || !result.filePaths[0]) return null;
    writeJson(syncSettingsFile, { directory: result.filePaths[0] }); return result.filePaths[0];
  });
  ipcMain.handle('desktop:sync:status', () => readJson(syncSettingsFile, {}));
  ipcMain.handle('desktop:sync:write', (_event, payload, passphrase) => {
    const secret = syncPassphrase(passphrase);
    const settings = readJson(syncSettingsFile, {}); if (typeof settings.directory !== 'string' || !settings.directory) throw new Error('Choose a sync directory first.');
    fs.mkdirSync(settings.directory, { recursive: true });
    const file = path.join(settings.directory, 'modulo-sync.enc'); const temporary = `${file}.tmp`; fs.writeFileSync(temporary, encryptPayload(String(payload), secret)); fs.renameSync(temporary, file); return file;
  });
  ipcMain.handle('desktop:sync:read', (_event, passphrase) => {
    const secret = syncPassphrase(passphrase);
    const settings = readJson(syncSettingsFile, {}); if (typeof settings.directory !== 'string' || !settings.directory) throw new Error('Choose a sync directory first.');
    return decryptPayload(fs.readFileSync(path.join(settings.directory, 'modulo-sync.enc'), 'utf8'), secret);
  });
}

async function fetchJson(url, init = {}, attempts = 2) {
  let last;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchRemote(url, { ...init, headers: { 'User-Agent': 'Modulo/0.1 (desktop metadata client)', Accept: 'application/json', ...(init.headers || {}) } });
      return JSON.parse(response.text);
    } catch (error) { last = error; if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 350)); }
  }
  throw last;
}
async function searchProvider(provider, rawQuery, credentials) {
  const query = String(rawQuery || '').trim(); if (!query) return [];
  const key = `${provider}:${query.toLowerCase()}`; const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  await reserveProviderRequest(provider);
  let value;
  if (provider === 'Open Library') {
    const body = await fetchJson(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10&fields=key,title,author_name,first_publish_year,cover_i`);
    value = (body.docs || []).map((item) => ({ provider, externalId: item.key, title: item.title, creator: item.author_name?.[0], year: item.first_publish_year ? String(item.first_publish_year) : undefined, artworkUrl: item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg` : undefined, sourceUrl: item.key ? `https://openlibrary.org${item.key}` : undefined, type: 'Book' }));
  } else if (provider === 'MusicBrainz') {
    const body = await fetchJson(`https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=10`);
    value = (body['release-groups'] || []).map((item) => ({ provider, externalId: item.id, title: item.title, creator: (item['artist-credit'] || []).map((credit) => credit.name).join(', '), year: item['first-release-date']?.slice(0, 4), artworkUrl: `https://coverartarchive.org/release-group/${item.id}/front-500`, sourceUrl: `https://musicbrainz.org/release-group/${item.id}`, type: item['primary-type'] === 'Single' ? 'Song' : 'Album' }));
  } else if (provider === 'TMDB') {
    if (!credentials.tmdbToken) throw new Error('Configure a TMDB token in desktop provider settings.');
    const body = await fetchJson(`https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&include_adult=false`, { headers: { Authorization: `Bearer ${credentials.tmdbToken}` } });
    value = (body.results || []).filter((item) => ['movie', 'tv'].includes(item.media_type)).map((item) => ({ provider, externalId: String(item.id), title: item.title || item.name, year: (item.release_date || item.first_air_date || '').slice(0, 4), artworkUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined, sourceUrl: `https://www.themoviedb.org/${item.media_type}/${item.id}`, type: item.media_type === 'tv' ? 'TV series' : 'Movie' }));
  } else if (provider === 'YouTube') {
    if (/youtu(?:\.be|be\.com)/i.test(query)) { const body = await fetchJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(query)}&format=json`); value = [{ provider, externalId: query, title: body.title, creator: body.author_name, artworkUrl: body.thumbnail_url, sourceUrl: query, type: 'YouTube video' }]; }
    else { if (!credentials.youtubeApiKey) throw new Error('Configure a YouTube API key in desktop provider settings.'); const body = await fetchJson(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(query)}&key=${encodeURIComponent(credentials.youtubeApiKey)}`); value = (body.items || []).map((item) => ({ provider, externalId: item.id?.videoId, title: item.snippet?.title, creator: item.snippet?.channelTitle, year: item.snippet?.publishedAt?.slice(0, 4), artworkUrl: item.snippet?.thumbnails?.medium?.url, sourceUrl: `https://www.youtube.com/watch?v=${item.id?.videoId}`, type: 'YouTube video' })); }
  } else if (provider === 'IGDB') {
    if (!credentials.igdbClientId || !credentials.igdbClientSecret) throw new Error('Configure IGDB/Twitch credentials in desktop provider settings.');
    const auth = await fetchJson(`https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(credentials.igdbClientId)}&client_secret=${encodeURIComponent(credentials.igdbClientSecret)}&grant_type=client_credentials`, { method: 'POST' });
    const body = await fetchJson('https://api.igdb.com/v4/games', { method: 'POST', headers: { 'Client-ID': credentials.igdbClientId, Authorization: `Bearer ${auth.access_token}`, 'Content-Type': 'text/plain' }, body: `search "${query.replace(/["\\]/g, '')}"; fields name,first_release_date,url,cover.url; limit 10;` });
    value = body.map((item) => ({ provider, externalId: String(item.id), title: item.name, year: item.first_release_date ? String(new Date(item.first_release_date * 1000).getUTCFullYear()) : undefined, artworkUrl: item.cover?.url ? `https:${item.cover.url.replace('t_thumb', 't_cover_big')}` : undefined, sourceUrl: item.url, type: 'Video game' }));
  } else throw new Error('Unsupported metadata provider.');
  value = value.filter((item) => item.externalId && item.title); cache.set(key, { at: Date.now(), value }); return value;
}

module.exports = { registerNativeServices, nextOccurrence, encryptPayload, decryptPayload, searchProvider, parseFeedXml, parseIcs, normalizeRemoteItems, normalizeWatches, normalizeReminders, buildWatchDelta, syncPassphrase, httpUrl, fetchText };
