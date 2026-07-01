import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from './cn';

/** Form field label. */
export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('text-[13px] font-medium text-foreground select-none', className)}
      {...props}
    />
  ),
);
Label.displayName = 'Label';
