import { type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
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
  /** Hide the default close button. */
  hideClose?: boolean;
}

/**
 * shadcn/ui Dialog (Radix), wrapped with the project's imperative
 * open/onClose/title/footer API. Provides focus trapping, scroll lock,
 * Escape + overlay-click close, and an accessible title out of the box.
 */
export function Modal({ open, onClose, title, description, children, footer, className, hideClose }: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border-strong bg-popover text-popover-foreground shadow-lg ' +
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            className,
          )}
        >
          {title ? (
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-[15px] font-semibold tracking-tight text-foreground">{title}</DialogPrimitive.Title>
                {description && <DialogPrimitive.Description className="mt-1 text-[13px] text-muted-foreground">{description}</DialogPrimitive.Description>}
              </div>
              {!hideClose && (
                <DialogPrimitive.Close className="-mr-1 -mt-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Close">
                  <X className="size-4" />
                </DialogPrimitive.Close>
              )}
            </div>
          ) : (
            <DialogPrimitive.Title className="sr-only">Dialog</DialogPrimitive.Title>
          )}
          {children && <div className="px-5 py-4">{children}</div>}
          {footer && <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
