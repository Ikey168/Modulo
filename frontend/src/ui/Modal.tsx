import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from './cn';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Max width utility class, e.g. 'max-w-md'. Defaults to 'max-w-lg'. */
  className?: string;
  /** Hide the default close button (e.g. for a custom header). */
  hideClose?: boolean;
}

/**
 * Lightweight portal-based modal dialog. Closes on backdrop click and Escape;
 * locks body scroll while open. No external dependency.
 */
export function Modal({ open, onClose, title, description, children, footer, className, hideClose }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'relative w-full max-w-lg rounded-xl border border-border-strong bg-popover text-popover-foreground shadow-lg animate-scale-in',
          className,
        )}
      >
        {(title || !hideClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              {title && <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>}
              {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
            </div>
            {!hideClose && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="-mr-1 -mt-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        )}
        {children && <div className="px-5 py-4">{children}</div>}
        {footer && <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
