import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

/** Multiline text input primitive. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-[13px] ' +
          'text-foreground placeholder:text-muted-foreground transition-colors resize-y ' +
          'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 ' +
          'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
