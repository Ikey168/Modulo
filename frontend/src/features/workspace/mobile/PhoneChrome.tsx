/**
 * Phone chrome for the workspace shell.
 *
 * The desktop shell is a 56px icon rail plus a hub sidebar — two levels of
 * navigation that are always on screen because there is room for them. A phone
 * has neither the width nor a hover state to explain an icon, so the same two
 * levels are re-cast in the platform's own vocabulary:
 *
 *   - a 56dp top app bar that names where you are and holds search + account;
 *   - a bottom navigation bar with the four destinations you actually switch
 *     between, labelled, within thumb reach, and out of the way when the
 *     keyboard is up;
 *   - a drawer holding the full list, reachable by tapping the menu button or
 *     swiping in from the left edge, as Android users expect;
 *   - a floating action button for the one thing a note-taking app is for.
 *
 * All of it is `md:hidden`: the desktop rail is untouched.
 */
import { useEffect, type ReactNode } from 'react';
import { LogOut, MoreHorizontal, Search, type LucideIcon } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/ui';
import type { PhoneNavEntry } from './phoneNav';

/** 56dp button + the 16px gap it is docked above the navigation bar with. */
const FAB_INSET = '4.5rem';

interface PhoneTopBarProps {
  title: string;
  onOpenNav: () => void;
  onOpenSearch: () => void;
  userLabel: string;
  userSub?: string;
  initials: string;
  onLogout: () => void;
  /** Rendered between the title and the actions, e.g. a sync indicator. */
  children?: ReactNode;
}

/** Modulo percent-sign brand mark, tinted by the primary token. */
function ModuloMark({ className }: { className?: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 22 22" fill="none" className={cn('shrink-0 text-primary', className)} aria-hidden="true">
      <line x1={5} y1={17.5} x2={17} y2={4.5} stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
      <circle cx={6.2} cy={6.2} r={3.4} fill="currentColor" />
      <circle cx={15.8} cy={15.8} r={3.4} fill="currentColor" opacity={0.7} />
    </svg>
  );
}

/** Three-line menu button. Drawn here rather than imported so the bars match. */
function MenuGlyph() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

export function PhoneTopBar({
  title,
  onOpenNav,
  onOpenSearch,
  userLabel,
  userSub,
  initials,
  onLogout,
  children,
}: PhoneTopBarProps) {
  return (
    // `-mt-safe-top pt-safe-top` paints the bar *behind* the status bar rather
    // than leaving a strip of page background above it — the difference
    // between a web page in a WebView and an app.
    <header className="-mt-safe-top z-30 flex shrink-0 flex-col border-b border-border bg-surface pt-safe-top md:hidden">
      <div className="flex h-14 items-center gap-1 pl-1 pr-2">
        <Button variant="ghost" size="icon" className="size-11 text-foreground" onClick={onOpenNav} aria-label="Open navigation">
          <MenuGlyph />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-tight">{title}</h1>
        {children}
        <Button variant="ghost" size="icon" className="size-11" onClick={onOpenSearch} aria-label="Search and commands">
          <Search />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-11" aria-label={`Account: ${userLabel}`}>
              <Avatar className="size-7">
                <AvatarFallback className="text-xxs">{initials || '?'}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuLabel>
              <span className="block truncate text-[13px]">{userLabel}</span>
              {userSub && <span className="block truncate text-xs font-normal text-muted-foreground">{userSub}</span>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout}>
              <LogOut className="size-4" aria-hidden="true" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

interface PhoneBottomNavProps {
  items: PhoneNavEntry[];
  activeId: string;
  onSelect: (id: string) => void;
  onOpenMore: () => void;
  /** True when the open view is not one of the bar's destinations. */
  moreActive: boolean;
}

export function PhoneBottomNav({ items, activeId, onSelect, onOpenMore, moreActive }: PhoneBottomNavProps) {
  return (
    <nav
      aria-label="Primary"
      data-hide-on-keyboard
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-safe-bottom pl-safe-left pr-safe-right md:hidden"
    >
      <div className="flex h-14 items-stretch">
        {items.map((item) => (
          <BottomNavItem
            key={item.id}
            active={item.id === activeId}
            label={item.label}
            icon={item.icon}
            onClick={() => onSelect(item.id)}
          />
        ))}
        <BottomNavItem active={moreActive} label="More" icon={MoreHorizontal} onClick={onOpenMore} />
      </div>
    </nav>
  );
}

function BottomNavItem({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 pt-1.5 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        active ? 'text-primary' : 'text-muted-foreground active:text-foreground',
      )}
    >
      {/* Material's active indicator: a pill behind the icon, so the state is
          legible without relying on colour alone. */}
      <span
        className={cn(
          'flex h-6 w-14 items-center justify-center rounded-full transition-colors',
          active && 'bg-primary/15',
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      {/* 12sp is Material's own bottom-navigation label; 11px reads as a
          caption under an icon rather than the name of a destination. */}
      <span className={cn('w-full truncate text-center text-xs leading-none', active && 'font-semibold')}>
        {label}
      </span>
    </button>
  );
}

interface PhoneNavDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PhoneNavEntry[];
  activeId: string;
  onSelect: (id: string) => void;
  userLabel: string;
  userSub?: string;
  initials: string;
  onLogout: () => void;
}

export function PhoneNavDrawer({
  open,
  onOpenChange,
  items,
  activeId,
  onSelect,
  userLabel,
  userSub,
  initials,
  onLogout,
}: PhoneNavDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-[19rem] max-w-[86vw] flex-col gap-0 bg-surface p-0">
        <SheetHeader className="border-b border-border px-4 py-4 text-left">
          <SheetTitle className="flex items-center gap-2.5 text-base tracking-tight">
            <ModuloMark />
            Modulo
          </SheetTitle>
          <SheetDescription className="sr-only">Workspace navigation</SheetDescription>
        </SheetHeader>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-2" aria-label="All destinations">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-touch w-full items-center gap-3 rounded-full px-4 text-left text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'bg-primary/15 text-primary' : 'text-subtle-foreground active:bg-surface-2',
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
        {/* Identity and sign-out were one button, so tapping your own name to
            see which account you were in signed you out of it. The row now
            only reports; the ⎋ beside it is the control. */}
        <div className="flex items-center gap-2 border-t border-border p-2 pl-3">
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="text-xxs">{initials || '?'}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] text-foreground">{userLabel}</span>
            {userSub && <span className="block truncate text-xs text-muted-foreground">{userSub}</span>}
          </span>
          <button
            type="button"
            onClick={onLogout}
            aria-label={`Log out of ${userLabel}`}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-surface-2 active:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut className="size-5" aria-hidden="true" />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Floating action button, docked above the bottom navigation. */
export function PhoneFab({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  // A 56dp button docked over a scrolling column covers whatever the column
  // ends with. Publishing its footprint lets the shell reserve that strip for
  // exactly as long as the button exists, on exactly the screens that have one.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--fab-inset', FAB_INSET);
    return () => {
      root.style.removeProperty('--fab-inset');
    };
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-hide-on-keyboard
      className={cn(
        'fixed bottom-[calc(3.5rem+var(--safe-bottom)+1rem)] right-4 z-30 flex size-14 items-center justify-center rounded-2xl',
        'bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'md:hidden',
      )}
    >
      <Icon className="size-6" aria-hidden="true" />
    </button>
  );
}
