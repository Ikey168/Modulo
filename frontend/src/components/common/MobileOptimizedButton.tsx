import React, { forwardRef, ButtonHTMLAttributes } from 'react';
import { useResponsive, usePrefersReducedMotion } from '../../hooks/useResponsive';
import './MobileOptimizedButton.css';

interface MobileOptimizedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large' | 'touch';
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  hapticFeedback?: boolean;
}

const MobileOptimizedButton = forwardRef<HTMLButtonElement, MobileOptimizedButtonProps>(
  ({
    variant = 'primary',
    size = 'medium',
    fullWidth = false,
    loading = false,
    leftIcon,
    rightIcon,
    hapticFeedback = true,
    className = '',
    children,
    onClick,
    disabled,
    ...props
  }, ref) => {
    const { isMobile, hasTouch } = useResponsive();
    const prefersReducedMotion = usePrefersReducedMotion();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || loading) return;

      // Add haptic feedback on supported devices
      if (hapticFeedback && hasTouch && navigator.vibrate) {
        navigator.vibrate(10); // Very light vibration
      }

      onClick?.(e);
    };

    const buttonClasses = [
      'mobile-button',
      `mobile-button--${variant}`,
      `mobile-button--${size}`,
      fullWidth && 'mobile-button--full-width',
      loading && 'mobile-button--loading',
      disabled && 'mobile-button--disabled',
      isMobile && 'mobile-button--mobile',
      hasTouch && 'mobile-button--touch',
      prefersReducedMotion && 'mobile-button--reduced-motion',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        className={buttonClasses}
        onClick={handleClick}
        disabled={disabled || loading}
        aria-label={props['aria-label'] || (typeof children === 'string' ? children : undefined)}
        {...props}
      >
        {loading && (
          <span className="mobile-button__spinner" aria-hidden="true">
            <span className="mobile-button__spinner-inner" />
          </span>
        )}
        
        {leftIcon && (
          <span className="mobile-button__icon mobile-button__icon--left" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        
        <span className="mobile-button__content">
          {children}
        </span>
        
        {rightIcon && (
          <span className="mobile-button__icon mobile-button__icon--right" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

MobileOptimizedButton.displayName = 'MobileOptimizedButton';

export default MobileOptimizedButton;
