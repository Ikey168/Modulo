import { createPortal } from 'react-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/ui';

/** Where the shell wants system banners drawn: directly under the app bar. */
export const BANNER_SLOT_ID = 'modulo-banner-slot';

/**
 * The shell's banner region.
 *
 * Rendered once by the workspace, immediately below the app bar and above the
 * view. Everything that needs to tell the user something about the *session*
 * rather than the screen — settings that would not sync, notes queued offline,
 * a device that is out of storage — lands here.
 */
export function BannerSlot({ className }: { className?: string }) {
  return (
    <div
      id={BANNER_SLOT_ID}
      className={cn('z-20 flex shrink-0 flex-col empty:hidden', className)}
    />
  );
}

/**
 * Puts a banner in the shell's slot, wherever in the tree it was declared.
 *
 * These notices are raised by providers that wrap the whole workspace, so
 * without this they render *above* the shell: on a desktop that costs a strip
 * of page, but on a phone it pushes the app bar off the top of the screen and
 * the first thing the app says is "Export settings recovery data". The slot
 * keeps the app bar first and the banner where a platform would put it.
 *
 * Falls back to rendering in place when no shell is mounted — the login screen
 * and the Android onboarding screen both raise these before there is a slot.
 */
export function SystemBanner({
  tone = 'neutral',
  children,
  ...rest
}: {
  /** `alert` colours the strip and gives it an assertive role. */
  tone?: 'neutral' | 'alert';
  children: ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  // The slot mounts with the shell, which may be a frame behind the provider
  // that raises the banner, so look again after paint rather than once.
  useEffect(() => {
    const find = () => setSlot(document.getElementById(BANNER_SLOT_ID));
    find();
    const frame = requestAnimationFrame(find);
    return () => cancelAnimationFrame(frame);
  }, []);

  const banner = (
    <div
      role={tone === 'alert' ? 'alert' : 'status'}
      {...rest}
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2.5 text-[13px]',
        // A banner is chrome, not content: it stays one or two lines and its
        // actions are real targets rather than underlined words.
        'coarse:[&_button]:min-h-touch [&_button]:font-medium [&_button]:underline [&_button]:underline-offset-2',
        tone === 'alert'
          ? 'border-destructive/40 bg-destructive/10 text-foreground [&_button]:text-destructive'
          : 'border-border bg-surface-2 text-subtle-foreground [&_button]:text-primary',
        rest.className,
      )}
    >
      {children}
    </div>
  );

  return slot ? createPortal(banner, slot) : banner;
}
