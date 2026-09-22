import { useEffect, useRef } from 'react';

/**
 * Swipe in from the left edge to open the drawer.
 *
 * Every Android app with a drawer supports this, and its absence is the kind of
 * thing that makes a packaged web app feel borrowed. The gesture only starts
 * inside the edge strip, so it never competes with a horizontally scrolling
 * tab row or a canvas pan further into the screen.
 */
export function useEdgeSwipe(onOpen: () => void, enabled = true): void {
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const EDGE_PX = 24;
    const TRIGGER_PX = 56;
    const SLOP_PX = 40;
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const down = (event: PointerEvent) => {
      tracking = event.pointerType === 'touch' && event.clientX <= EDGE_PX;
      startX = event.clientX;
      startY = event.clientY;
    };
    const move = (event: PointerEvent) => {
      if (!tracking) return;
      const dx = event.clientX - startX;
      // A mostly-vertical drag is a scroll, not a drawer pull.
      if (Math.abs(event.clientY - startY) > SLOP_PX) {
        tracking = false;
        return;
      }
      if (dx >= TRIGGER_PX) {
        tracking = false;
        onOpenRef.current();
      }
    };
    const stop = () => {
      tracking = false;
    };

    window.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', stop, { passive: true });
    window.addEventListener('pointercancel', stop, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [enabled]);
}
