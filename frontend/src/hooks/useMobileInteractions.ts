import { useState, useEffect } from 'react';

interface SwipeDirection {
  deltaX: number;
  deltaY: number;
  direction: 'left' | 'right' | 'up' | 'down' | null;
}

interface SwipeOptions {
  threshold?: number;
  preventDefault?: boolean;
  trackMouse?: boolean;
}

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onSwipe?: (direction: SwipeDirection) => void;
}

export const useSwipe = (
  handlers: SwipeHandlers,
  options: SwipeOptions = {}
) => {
  const {
    threshold = 50,
    preventDefault = true,
    trackMouse = false
  } = options;

  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [touchEnd, setTouchEnd] = useState<{x: number, y: number} | null>(null);

  const handleTouchStart = (e: TouchEvent | MouseEvent) => {
    if (preventDefault) e.preventDefault();
    
    const touch = 'touches' in e ? e.touches[0] : e as MouseEvent;
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchEnd(null);
  };

  const handleTouchMove = (e: TouchEvent | MouseEvent) => {
    const touch = 'touches' in e ? e.touches[0] : e as MouseEvent;
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const deltaX = touchEnd.x - touchStart.x;
    const deltaY = touchEnd.y - touchStart.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (Math.max(absDeltaX, absDeltaY) < threshold) return;

    let direction: SwipeDirection['direction'] = null;

    if (absDeltaX > absDeltaY) {
      direction = deltaX > 0 ? 'right' : 'left';
      if (direction === 'left' && handlers.onSwipeLeft) handlers.onSwipeLeft();
      if (direction === 'right' && handlers.onSwipeRight) handlers.onSwipeRight();
    } else {
      direction = deltaY > 0 ? 'down' : 'up';
      if (direction === 'up' && handlers.onSwipeUp) handlers.onSwipeUp();
      if (direction === 'down' && handlers.onSwipeDown) handlers.onSwipeDown();
    }

    if (handlers.onSwipe) {
      handlers.onSwipe({ deltaX, deltaY, direction });
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  const getSwipeProps = () => ({
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    ...(trackMouse && {
      onMouseDown: handleTouchStart,
      onMouseMove: handleTouchMove,
      onMouseUp: handleTouchEnd,
    })
  });

  return { getSwipeProps };
};

// Hook for detecting touch vs mouse interactions
export const useTouchDevice = () => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouchDevice(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-ignore - legacy property
        navigator.msMaxTouchPoints > 0
      );
    };

    checkTouch();
    window.addEventListener('touchstart', checkTouch, { once: true });

    return () => {
      window.removeEventListener('touchstart', checkTouch);
    };
  }, []);

  return isTouchDevice;
};

// Hook for managing scroll behavior on mobile
export const useMobileScroll = (options: {
  preventBounce?: boolean;
  threshold?: number;
} = {}) => {
  const { preventBounce = true, threshold = 10 } = options;
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (Math.abs(currentScrollY - lastScrollY) > threshold) {
        setScrollDirection(currentScrollY > lastScrollY ? 'down' : 'up');
        setLastScrollY(currentScrollY);
      }

      setIsScrolling(true);
      
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    };

    const preventBounceScroll = (e: TouchEvent) => {
      if (!preventBounce) return;
      
      const target = e.target as Element;
      const isScrollable = target.closest('[data-scrollable="true"]') ||
                          target.closest('.scrollable') ||
                          target.scrollHeight > target.clientHeight;
      
      if (!isScrollable) {
        e.preventDefault();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    if (preventBounce) {
      document.addEventListener('touchmove', preventBounceScroll, { passive: false });
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (preventBounce) {
        document.removeEventListener('touchmove', preventBounceScroll);
      }
      clearTimeout(timeoutId);
    };
  }, [lastScrollY, threshold, preventBounce]);

  return {
    isScrolling,
    scrollDirection,
    lastScrollY
  };
};
