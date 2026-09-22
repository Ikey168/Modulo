import { useEffect, useRef, useState } from 'react';

/** How far the finger travels before the gesture commits to a refresh. */
const TRIGGER_PX = 72;
/** Ceiling for the indicator's travel, so a long drag does not run off screen. */
const MAX_PULL_PX = 110;
/** A drag this much more horizontal than vertical is a swipe, not a pull. */
const HORIZONTAL_SLOP_PX = 24;

export interface PullToRefreshState {
  /** 0…1 — how close the pull is to committing. Drives the indicator. */
  progress: number;
  /** The refresh is running; the indicator stays put and spins. */
  refreshing: boolean;
}

/**
 * Pull down at the top of a list to refresh it.
 *
 * Every Android app that shows a server-backed list has this, and reaching for
 * it and finding nothing is one of the clearest tells that you are looking at
 * a packaged web page. The alternative here was a Refresh item buried in a
 * menu, which is a desktop answer to a question the platform already answered.
 *
 * The gesture only starts when the scroll container is genuinely at the top and
 * the finger is moving down, so it never steals a scroll, a horizontal swipe on
 * a tab strip, or a pan inside a canvas.
 *
 * @param container the scrolling element to watch (the shell's content column).
 * @param onRefresh work to run once the pull commits.
 * @param enabled   false on a desktop pointer, where there is no such gesture.
 */
export function usePullToRefresh(
  container: React.RefObject<HTMLElement>,
  onRefresh: () => Promise<unknown>,
  enabled = true,
): PullToRefreshState {
  const [progress, setProgress] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  const busy = useRef(false);

  useEffect(() => {
    const host = container.current;
    if (!enabled || !host || typeof window === 'undefined') return;

    let startY = 0;
    let startX = 0;
    let tracking = false;
    let pulled = 0;

    /** The innermost scrollable ancestor of the touch, or null if none scrolls. */
    const scrollerAt = (target: EventTarget | null): HTMLElement | null => {
      let node = target instanceof HTMLElement ? target : null;
      while (node && node !== host.parentElement) {
        const style = getComputedStyle(node);
        const scrolls = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
        if (scrolls) return node;
        node = node.parentElement;
      }
      return null;
    };

    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || busy.current) return;
      const scroller = scrollerAt(event.target);
      // Only the top of the view pulls. Anywhere else, the finger is scrolling.
      if (scroller && scroller.scrollTop > 0) return;
      tracking = true;
      startY = event.clientY;
      startX = event.clientX;
      pulled = 0;
    };

    const move = (event: PointerEvent) => {
      if (!tracking) return;
      const dy = event.clientY - startY;
      const dx = event.clientX - startX;
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy) + HORIZONTAL_SLOP_PX) {
        tracking = false;
        pulled = 0;
        setProgress(0);
        return;
      }
      // Resistance: the sheet follows the finger at a decreasing rate, which is
      // what tells you the list has reached its end rather than stuck.
      pulled = Math.min(MAX_PULL_PX, dy * 0.5);
      setProgress(Math.min(1, pulled / TRIGGER_PX));
    };

    const up = () => {
      if (!tracking) return;
      tracking = false;
      const commit = pulled >= TRIGGER_PX;
      pulled = 0;
      if (!commit) {
        setProgress(0);
        return;
      }
      busy.current = true;
      setRefreshing(true);
      setProgress(1);
      void Promise.resolve(refreshRef.current())
        .catch(() => {
          // The view reports its own failure; the indicator just has to stop.
        })
        .finally(() => {
          busy.current = false;
          setRefreshing(false);
          setProgress(0);
        });
    };

    host.addEventListener('pointerdown', down, { passive: true });
    host.addEventListener('pointermove', move, { passive: true });
    host.addEventListener('pointerup', up, { passive: true });
    host.addEventListener('pointercancel', up, { passive: true });
    return () => {
      host.removeEventListener('pointerdown', down);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerup', up);
      host.removeEventListener('pointercancel', up);
    };
  }, [container, enabled]);

  return { progress, refreshing };
}
