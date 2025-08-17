import React, { ReactNode, useRef, useState } from 'react';

interface TouchHandlerProps {
  children: ReactNode;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  className?: string;
  disabled?: boolean;
  swipeThreshold?: number;
  longPressDelay?: number;
  doubleTapDelay?: number;
}

const TouchHandler: React.FC<TouchHandlerProps> = ({
  children,
  onTap,
  onDoubleTap,
  onLongPress,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  className = '',
  disabled = false,
  swipeThreshold = 50,
  longPressDelay = 500,
  doubleTapDelay = 300,
}) => {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<number>(0);
  const [isPressed, setIsPressed] = useState(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;

    const touch = e.touches[0];
    const currentTime = Date.now();
    
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: currentTime,
    };

    setIsPressed(true);

    // Start long press timer
    if (onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        onLongPress();
        setIsPressed(false);
      }, longPressDelay);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (disabled || !touchStartRef.current) return;

    clearLongPressTimer();
    setIsPressed(false);

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Check for swipe gestures
    if (distance > swipeThreshold && deltaTime < 300) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > absY) {
        // Horizontal swipe
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
          return;
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
          return;
        }
      } else {
        // Vertical swipe
        if (deltaY > 0 && onSwipeDown) {
          onSwipeDown();
          return;
        } else if (deltaY < 0 && onSwipeUp) {
          onSwipeUp();
          return;
        }
      }
    }

    // Check for tap gestures
    if (distance <= swipeThreshold && deltaTime < 300) {
      const currentTime = Date.now();
      const timeSinceLastTap = currentTime - lastTapRef.current;

      if (timeSinceLastTap < doubleTapDelay && onDoubleTap) {
        onDoubleTap();
        lastTapRef.current = 0; // Reset to prevent triple tap
      } else if (onTap) {
        lastTapRef.current = currentTime;
        // Delay single tap to allow for double tap detection
        setTimeout(() => {
          if (Date.now() - lastTapRef.current >= doubleTapDelay - 50) {
            onTap();
          }
        }, doubleTapDelay);
      }
    }

    touchStartRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || !touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

    // Cancel long press if user moves finger too much
    if (deltaX > 10 || deltaY > 10) {
      clearLongPressTimer();
    }
  };

  const handleTouchCancel = () => {
    if (disabled) return;
    
    clearLongPressTimer();
    setIsPressed(false);
    touchStartRef.current = null;
  };

  // Mouse events for desktop compatibility
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;

    const currentTime = Date.now();
    touchStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: currentTime,
    };

    setIsPressed(true);

    if (onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        onLongPress();
        setIsPressed(false);
      }, longPressDelay);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (disabled || !touchStartRef.current) return;

    clearLongPressTimer();
    setIsPressed(false);

    const deltaX = e.clientX - touchStartRef.current.x;
    const deltaY = e.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance <= 10 && deltaTime < 300) {
      const currentTime = Date.now();
      const timeSinceLastTap = currentTime - lastTapRef.current;

      if (timeSinceLastTap < doubleTapDelay && onDoubleTap) {
        onDoubleTap();
        lastTapRef.current = 0;
      } else if (onTap) {
        lastTapRef.current = currentTime;
        setTimeout(() => {
          if (Date.now() - lastTapRef.current >= doubleTapDelay - 50) {
            onTap();
          }
        }, doubleTapDelay);
      }
    }

    touchStartRef.current = null;
  };

  const handleMouseLeave = () => {
    if (disabled) return;
    
    clearLongPressTimer();
    setIsPressed(false);
    touchStartRef.current = null;
  };

  const combinedClassName = `${className} ${isPressed ? 'touch-pressed' : ''}`.trim();

  return (
    <div
      className={combinedClassName}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchCancel={handleTouchCancel}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{
        touchAction: 'manipulation',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {children}
    </div>
  );
};

export default TouchHandler;
