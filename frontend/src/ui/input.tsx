import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const base =
  // 13px/36px is a mouse-and-keyboard field. On a touch screen the row grows to
  // a thumb's width and the text to a size that is readable at arm's length —
  // 16px also stops mobile browsers zooming the page on focus.
  'flex h-9 w-full rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-[13px] text-foreground ' +
  'coarse:h-11 coarse:text-base ' +
  'placeholder:text-muted-foreground transition-colors ' +
  'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 ' +
  'file:border-0 file:bg-transparent file:text-sm file:font-medium';

/** Text input primitive. */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input ref={ref} type={type} className={cn(base, className)} {...props} />
  ),
);
Input.displayName = 'Input';
