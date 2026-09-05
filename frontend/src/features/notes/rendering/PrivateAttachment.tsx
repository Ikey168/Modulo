import { useEffect, useState, useSyncExternalStore, type ImgHTMLAttributes, type AnchorHTMLAttributes } from 'react';
import { authService } from '../../auth/authService';
import { authenticatedRequest } from '../../../services/authenticatedRequest';

function privatePath(value?: string): boolean {
  if (!value) return false;
  const url = new URL(value, window.location.origin);
  return url.origin === window.location.origin && /^\/api\/files\/\d+\/[^/]+$/.test(url.pathname);
}
const identity = () => {
  const session = authService.stateSession();
  return session ? JSON.stringify([session.issuer, session.subject]) : '';
};
const subscribe = (listener: () => void) => authService.subscribeSession(listener);

export function PrivateAttachmentImage({ src, srcSet, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const owner = useSyncExternalStore(subscribe, identity);
  const [loaded, setLoaded] = useState<{ path: string; owner: string; url: string }>();
  const protectedFile = privatePath(src);
  useEffect(() => {
    if (!protectedFile || !src || !owner) return;
    const abort = new AbortController();
    let objectUrl: string | undefined;
    void authenticatedRequest(src, { signal: abort.signal }).then(async response => {
      if (!response.ok) throw new Error('Attachment unavailable');
      const blob = await response.blob();
      if (abort.signal.aborted || identity() !== owner) return;
      objectUrl = URL.createObjectURL(blob);
      setLoaded({ path: src, owner, url: objectUrl });
    }).catch(() => { /* The alt text remains visible when access fails. */ });
    return () => { abort.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src, owner, protectedFile]);
  const imageUrl = protectedFile ? (loaded && loaded.path === src && loaded.owner === owner ? loaded.url : undefined) : src;
  return <img {...props} src={imageUrl} srcSet={protectedFile ? undefined : srcSet} />;
}

export function PrivateAttachmentLink({ href, onClick, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const [error, setError] = useState(false);
  return <><a {...props} href={href} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || !privatePath(href)) return;
    event.preventDefault();
    const owner = identity();
    setError(false);
    void authenticatedRequest(href!).then(async response => {
      if (!response.ok) throw new Error('Attachment unavailable');
      const blob = await response.blob();
      if (identity() !== owner) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = typeof children === 'string' ? children : 'attachment';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }).catch(() => setError(true));
  }}>{children}</a>{error && <span role="alert">Attachment unavailable</span>}</>;
}
