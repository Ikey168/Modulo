import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Opens the record named in the URL, then clears the parameter.
 *
 * Dashboards used to render per-record rows whose handler threw the record
 * away — `onClick={() => navigateView('information-intake')}` for every row —
 * so clicking a named item landed on an unfiltered list with nothing selected.
 * The plugin contract passes `navigateView(view: string)` and nothing else, but
 * the workspace route is `/app/:view`, so a query string rides along untouched:
 * a dashboard calls `navigateView('information-intake?item=abc')` and the target
 * view calls this to honour it.
 *
 * The parameter is consumed on arrival so closing the record does not reopen it
 * on the next render, and so a reload does not resurrect a dismissed overlay.
 */
export function useDeepLink(param: string, onOpen: (id: string) => void): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(param);

  useEffect(() => {
    if (!value) return;
    onOpen(value);
    const next = new URLSearchParams(searchParams);
    next.delete(param);
    setSearchParams(next, { replace: true });
    // `onOpen` is a fresh closure each render; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, param]);
}
