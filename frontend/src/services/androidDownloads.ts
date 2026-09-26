import type { ShareBridge } from './androidShare';

/**
 * The Android WebView ignores `<a download>`: exports, backups and recovery
 * files built as blobs would silently do nothing. On Android, a download link
 * is routed to the system "save to" dialog (Storage Access Framework) instead,
 * so every existing export works without each feature knowing the platform
 * (#493).
 *
 * Many callers revoke the object URL right after `click()`, so blobs are kept
 * by URL at creation and resolved synchronously when the link is clicked.
 */
function readBlob(blob: Blob, win: Window & typeof globalThis): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new win.FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'));
    reader.readAsArrayBuffer(blob);
  });
}

/** Dispatched on window with a DownloadOutcome when a routed download finishes. */
export const DOWNLOAD_EVENT = 'modulo:download';

export interface DownloadOutcome { name: string; saved: boolean; cancelled?: boolean; error?: string }

export function installAndroidDownloads(bridge: Pick<ShareBridge, 'saveDocument'>,
  onOutcome: (outcome: DownloadOutcome) => void = () => {}, win: Window & typeof globalThis = window): () => void {
  const blobs = new Map<string, Blob>();
  const create = win.URL.createObjectURL.bind(win.URL);
  const revoke = win.URL.revokeObjectURL.bind(win.URL);
  const click = win.HTMLAnchorElement.prototype.click;

  win.URL.createObjectURL = (object: Blob | MediaSource) => {
    const url = create(object);
    if (object instanceof win.Blob) blobs.set(url, object);
    return url;
  };
  // Keep the blob until the save completed; the caller's revoke is deferred.
  win.URL.revokeObjectURL = (url: string) => { win.setTimeout(() => { blobs.delete(url); revoke(url); }, 60_000); };

  const resolve = (anchor: HTMLAnchorElement): Blob | undefined => {
    const href = anchor.href;
    if (href.startsWith('blob:')) return blobs.get(href);
    const data = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(href);
    if (!data) return undefined;
    const body = data[2] ? atob(data[3]) : decodeURIComponent(data[3]);
    return new win.Blob([Uint8Array.from(body, char => char.charCodeAt(0))], { type: data[1] || 'application/octet-stream' });
  };

  const save = (anchor: HTMLAnchorElement): boolean => {
    if (!anchor.hasAttribute('download')) return false;
    const blob = resolve(anchor);
    if (!blob) return false;
    const name = (anchor.getAttribute('download') || 'download').replace(/[\\/]/g, '_').slice(0, 200) || 'download';
    void readBlob(blob, win).then(buffer => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      return bridge.saveDocument({ name, mime: blob.type || 'application/octet-stream', data: btoa(binary) });
    }).then(result => onOutcome({ name, saved: !!result.saved, cancelled: !!result.cancelled }),
      error => onOutcome({ name, saved: false, error: error instanceof Error ? error.message : 'The file could not be saved.' }));
    return true;
  };

  // Programmatic `anchor.click()` on a detached link never reaches document listeners.
  win.HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    if (!save(this)) click.call(this);
  };
  const onClick = (event: MouseEvent) => {
    const anchor = (event.target as Element | null)?.closest?.('a[download]');
    if (anchor instanceof win.HTMLAnchorElement && save(anchor)) event.preventDefault();
  };
  win.document.addEventListener('click', onClick, true);

  return () => {
    win.URL.createObjectURL = create;
    win.URL.revokeObjectURL = revoke;
    win.HTMLAnchorElement.prototype.click = click;
    win.document.removeEventListener('click', onClick, true);
  };
}
