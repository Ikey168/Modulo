import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Spinner } from './spinner';

/**
 * Invisible 44px hit area centred on a control that is drawn smaller.
 *
 * The workspace is a dense desktop UI: its icon buttons are 28px, well under
 * the 48dp Android asks for. Growing them on touch would reflow every toolbar
 * in 177 plugin views, so the *target* grows and the drawing does not.
 */
const touchTarget =
  "coarse:relative coarse:after:absolute coarse:after:left-1/2 coarse:after:top-1/2 " +
  "coarse:after:size-11 coarse:after:-translate-x-1/2 coarse:after:-translate-y-1/2 coarse:after:content-['']";

// shadcn/ui button, extended with the project's variant/size vocabulary
// (primary/md/icon-sm) and a `loading` state so existing call sites keep working.
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
    'focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 select-none ' +
    // Touch has no hover state, so the press itself has to acknowledge the tap.
    'coarse:active:opacity-70 ' +
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover',
        secondary: 'bg-secondary text-secondary-foreground border border-border-strong hover:bg-surface-3',
        outline: 'border border-border-strong bg-transparent text-foreground hover:bg-surface-2',
        ghost: 'bg-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground',
        destructive: 'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90',
        link: 'text-primary underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        // Text buttons gain real height on a touch screen; icon buttons keep
        // their drawn size and gain an invisible target instead. A labelled
        // button is its own target — nothing else can be tapped through it —
        // so it grows to the 44px minimum rather than hiding a target behind
        // a 36px pill the thumb keeps missing.
        sm: 'h-8 px-3 text-xs coarse:h-11 coarse:px-4 coarse:text-[13px] [&_svg]:size-3.5 coarse:[&_svg]:size-4',
        md: 'h-9 px-4 text-[13px] coarse:h-11 coarse:text-sm [&_svg]:size-4',
        lg: 'h-11 px-6 text-sm coarse:h-12 [&_svg]:size-[18px]',
        icon: `h-9 w-9 coarse:size-11 [&_svg]:size-4 ${touchTarget}`,
        'icon-sm': `h-7 w-7 [&_svg]:size-3.5 ${touchTarget}`,
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as the child element (shadcn Slot pattern), e.g. wrap a Link. */
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={asChild ? undefined : disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {/* Slot requires exactly one child, so the loading spinner only
            renders for real <button> elements. */}
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Spinner className="size-4" />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
