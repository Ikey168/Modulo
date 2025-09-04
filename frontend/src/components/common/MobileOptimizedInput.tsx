import React, { forwardRef, InputHTMLAttributes, useState, useRef, useImperativeHandle } from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import './MobileOptimizedInput.css';

interface MobileOptimizedInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  success?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  variant?: 'outlined' | 'filled' | 'standard';
  fullWidth?: boolean;
  clearable?: boolean;
  onClear?: () => void;
}

const MobileOptimizedInput = forwardRef<HTMLInputElement, MobileOptimizedInputProps>(
  ({
    label,
    error,
    success,
    helperText,
    leftIcon,
    rightIcon,
    size = 'medium',
    variant = 'outlined',
    fullWidth = false,
    clearable = false,
    onClear,
    className = '',
    value,
    onChange,
    onFocus,
    onBlur,
    disabled,
    required,
    ...props
  }, ref) => {
    const { isMobile, isIOS } = useResponsive();
    const [isFocused, setIsFocused] = useState(false);
    const [hasValue, setHasValue] = useState(Boolean(value));
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(Boolean(e.target.value));
      onChange?.(e);
    };

    const handleClear = () => {
      if (inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.focus();
        setHasValue(false);
        onClear?.();
      }
    };

    const inputId = props.id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = Boolean(error);
    const hasSuccess = Boolean(success);

    const containerClasses = [
      'mobile-input-container',
      `mobile-input-container--${variant}`,
      `mobile-input-container--${size}`,
      fullWidth && 'mobile-input-container--full-width',
      isFocused && 'mobile-input-container--focused',
      hasValue && 'mobile-input-container--has-value',
      hasError && 'mobile-input-container--error',
      hasSuccess && 'mobile-input-container--success',
      disabled && 'mobile-input-container--disabled',
      isMobile && 'mobile-input-container--mobile',
      isIOS && 'mobile-input-container--ios',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const inputClasses = [
      'mobile-input',
      leftIcon && 'mobile-input--with-left-icon',
      rightIcon && 'mobile-input--with-right-icon',
      clearable && hasValue && 'mobile-input--with-clear',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={containerClasses}>
        {label && (
          <label htmlFor={inputId} className="mobile-input-label">
            {label}
            {required && <span className="mobile-input-required" aria-label="required">*</span>}
          </label>
        )}
        
        <div className="mobile-input-wrapper">
          {leftIcon && (
            <span className="mobile-input-icon mobile-input-icon--left" aria-hidden="true">
              {leftIcon}
            </span>
          )}
          
          <input
            ref={inputRef}
            id={inputId}
            className={inputClasses}
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={disabled}
            required={required}
            aria-invalid={hasError}
            aria-describedby={
              [
                error && `${inputId}-error`,
                success && `${inputId}-success`,
                helperText && `${inputId}-helper`,
              ]
                .filter(Boolean)
                .join(' ') || undefined
            }
            {...props}
          />
          
          {clearable && hasValue && !disabled && (
            <button
              type="button"
              className="mobile-input-clear"
              onClick={handleClear}
              aria-label="Clear input"
              tabIndex={-1}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="15 9l-6 6" />
                <path d="9 9l6 6" />
              </svg>
            </button>
          )}
          
          {rightIcon && (
            <span className="mobile-input-icon mobile-input-icon--right" aria-hidden="true">
              {rightIcon}
            </span>
          )}
        </div>
        
        {(error || success || helperText) && (
          <div className="mobile-input-message-container">
            {error && (
              <div id={`${inputId}-error`} className="mobile-input-message mobile-input-message--error" role="alert">
                {error}
              </div>
            )}
            {success && (
              <div id={`${inputId}-success`} className="mobile-input-message mobile-input-message--success">
                {success}
              </div>
            )}
            {helperText && !error && !success && (
              <div id={`${inputId}-helper`} className="mobile-input-message mobile-input-message--helper">
                {helperText}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

MobileOptimizedInput.displayName = 'MobileOptimizedInput';

export default MobileOptimizedInput;
