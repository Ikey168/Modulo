import { authenticatedRequest } from '../services/authenticatedRequest';
import { desktopServices, type DesktopServices } from './desktop';

/**
 * Network and document services a plugin needs regardless of platform (#495).
 * The desktop shell runs them locally; everywhere else (Android, browsers)
 * the same calls go to the Modulo server's `/api/remote` adapters, which hold
 * provider credentials and apply the server's outbound-request policy. Results
 * have the same shape on both routes.
 */
export type WatchState = {
  id: string; url: string; selector?: string; lastHash?: string; lastSnapshot?: string;
};
export type WatchResult = WatchState & {
  status: string; previousHash?: string; previousSnapshot?: string; lastChecked?: string; lastChanged?: string;
  changeSummary?: string; materiality?: 'Unknown' | 'Minor' | 'Material'; addedLines?: string[]; removedLines?: string[];
  sourceUrl?: string; error?: string;
};

export interface NetworkServices {
  /** 'desktop' runs locally; 'server' calls the Modulo server. */
  readonly route: 'desktop' | 'server';
  credentials: Pick<DesktopServices['credentials'], 'set'>;
  providers: DesktopServices['providers'];
  feeds: DesktopServices['feeds'];
  archive: {
    capture: (url: string) => Promise<Awaited<ReturnType<DesktopServices['archive']['capture']>> & { fileId?: string }>;
    import: DesktopServices['archive']['import'];
  };
  caldav: DesktopServices['caldav'];
  ntfy: DesktopServices['ntfy'];
}

/** Server error codes as sentences a user can act on. */
const MESSAGES: Record<string, string> = {
  URL_INVALID: 'Enter a valid web address.',
  URL_SCHEME_NOT_ALLOWED: 'Use an http:// or https:// address.',
  URL_CREDENTIALS_NOT_ALLOWED: 'Remove the user name and password from the address; save them as a credential instead.',
  URL_PORT_NOT_ALLOWED: 'The server only connects to ports 80, 443, 8080 and 8443.',
  URL_ADDRESS_NOT_ALLOWED: 'The Modulo server does not connect to private or local network addresses. Use the desktop app for services on your home network.',
  REMOTE_HOST_UNKNOWN: 'That host name could not be found.',
  REMOTE_UNREACHABLE: 'The service did not respond. Check the address and try again.',
  REMOTE_AUTH_REJECTED: 'The service rejected the saved credentials.',
  REMOTE_NOT_FOUND: 'Nothing was found at that address.',
  REMOTE_RESPONSE_TOO_LARGE: 'The response was larger than 5 MB.',
  REMOTE_CREDENTIALS_UNCONFIGURED: 'This Modulo server cannot store service credentials yet. Ask its administrator to set MODULO_REMOTE_CREDENTIAL_KEY.',
  CREDENTIAL_MISSING_MINIFLUX: 'Save a Miniflux API token first.',
  CREDENTIAL_MISSING_CALDAV: 'Save CalDAV credentials first.',
  CREDENTIAL_MISSING_TMDB: 'Save a TMDB token first.',
  CREDENTIAL_MISSING_YOUTUBE: 'Save a YouTube API key first.',
  CREDENTIAL_MISSING_IGDB: 'Save IGDB/Twitch credentials first.',
  NTFY_TOPIC_REQUIRED: 'Enter an ntfy topic.',
  PDF_ENCRYPTED: 'Password-protected PDFs cannot be processed.',
  PDF_INVALID: 'One of the files is not a readable PDF.',
  PDF_TOO_LARGE: 'Each PDF must be 25 MB or smaller.',
  PDF_TOO_MANY_PAGES: 'The PDFs have more than 2,000 pages together.',
  PDF_MERGE_NEEDS_TWO: 'Choose at least two PDFs to merge.',
};

export class RemoteServiceError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await authenticatedRequest(`/api/remote${path}`, {
    ...init, headers: init.body instanceof FormData ? init.headers : { 'Content-Type': 'application/json', ...init.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { code?: string };
    const code = body.code || `HTTP_${response.status}`;
    throw new RemoteServiceError(code, MESSAGES[code] ?? (response.status >= 500 ? 'The Modulo server could not complete the request.' : `Request failed (${code}).`));
  }
  return response.json() as Promise<T>;
}

const post = <T,>(path: string, body: unknown) => call<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const serverNetworkServices: NetworkServices = {
  route: 'server',
  credentials: { set: (key, value) => call(`/credentials/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ value }) }) },
  providers: { search: (provider, query) => call(`/metadata?provider=${encodeURIComponent(provider)}&q=${encodeURIComponent(query)}`) },
  feeds: { sync: options => post('/feeds', options) },
  archive: { capture: url => post('/archive/capture', { url }), import: options => post('/archive/import', options) },
  caldav: { sync: url => post('/caldav', { url }) },
  ntfy: { publish: options => post('/ntfy', options) },
};

export function networkServices(): NetworkServices {
  const desktop = desktopServices();
  return desktop ? { route: 'desktop', ...desktop } : serverNetworkServices;
}

/** One stateless web-watch check per item on the server; the caller stores the returned state. */
export function checkWatchesOnServer(items: WatchState[]): Promise<WatchResult[]> {
  return post('/web-watch/check', { items });
}

/** Runs a PDF operation on the server and returns the result file. */
export async function runPdfOnServer(operation: 'Merge' | 'Split' | 'Rotate' | 'Extract text', files: File[]):
  Promise<{ file: File; details: string }> {
  const form = new FormData();
  form.set('operation', operation);
  for (const file of files) form.append('files', file, file.name);
  const response = await authenticatedRequest('/api/remote/pdf', { method: 'POST', body: form });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { code?: string };
    const code = body.code || `HTTP_${response.status}`;
    throw new RemoteServiceError(code, MESSAGES[code] ?? 'The PDF operation failed.');
  }
  const name = /filename\*=UTF-8''([^;]+)/.exec(response.headers.get('Content-Disposition') ?? '')?.[1];
  const blob = await response.blob();
  return { file: new File([blob], name ? decodeURIComponent(name) : 'result', { type: blob.type }),
    details: response.headers.get('X-Modulo-Details') ?? '' };
}
