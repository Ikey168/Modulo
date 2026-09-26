/**
 * Phone replacement for a hub's secondary sidebar.
 *
 * On a desktop a hub shows a 208px list of every view it contains, grouped by
 * section. On a phone that list was a horizontally scrolling tab strip, which
 * works while a hub holds five or six views and stops working at the scale this
 * workspace actually reaches: a hub built from a large pack can hold dozens,
 * and a strip shows three at a time with the fourth clipped mid-word. Finding
 * one meant swiping past all the others, and the strip never said how many
 * others there were.
 *
 * A combo box says where you are in full, in one line, and opens the complete
 * grouped list — with a filter once the list outgrows a screen — so any view is
 * two taps away no matter how many the hub has.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import {
  cn,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/ui';
import { viewSectionLabel, type ModeInfo } from '../plugins/modes';
import type { ViewContribution } from '../plugins/types';

/** Above this many views, hunting beats scrolling and the sheet gains a filter. */
const FILTER_THRESHOLD = 8;

export function HubViewPicker({
  mode,
  tabs,
  activeTab,
  onSelectTab,
}: {
  mode: ModeInfo;
  tabs: ViewContribution[];
  activeTab: ViewContribution;
  onSelectTab: (viewId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const activeRef = useRef<HTMLButtonElement>(null);

  // Reopening should show the list as it is, not as it was left mid-search.
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  // Open on the view you are in, however far down the list it sits.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      // Guarded: not every environment the shell renders in implements it, and
      // failing to scroll is never worth throwing over.
      activeRef.current?.scrollIntoView?.({ block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const needle = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      needle
        ? tabs.filter(
            (tab) =>
              tab.label.toLowerCase().includes(needle) ||
              (viewSectionLabel(tab) ?? '').toLowerCase().includes(needle),
          )
        : tabs,
    [tabs, needle],
  );

  const ActiveIcon = activeTab.icon;
  const ModeIcon = mode.icon;
  const activeSection = viewSectionLabel(activeTab);
  const showFilter = tabs.length > FILTER_THRESHOLD;

  return (
    <div className="shrink-0 border-b border-border bg-background px-3 py-2 sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${activeTab.label} — choose a ${mode.label} view`}
        className={cn(
          'flex min-h-touch w-full items-center gap-2.5 rounded-md border border-border-strong bg-surface-2 pl-3 pr-2.5 text-left text-[15px] text-foreground transition-colors',
          'active:bg-surface-3 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        )}
      >
        <ActiveIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-medium">{activeTab.label}</span>
        {/* The section is what tells three "Dashboard" entries apart. */}
        {activeSection && (
          <span className="shrink-0 truncate text-xs text-muted-foreground">{activeSection}</span>
        )}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="flex max-h-[85dvh] flex-col gap-0 rounded-t-2xl bg-surface px-0 pt-3"
        >
          <SheetHeader className="px-4 pb-2 text-left">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <ModeIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              {mode.label}
              <span className="font-normal text-muted-foreground">{tabs.length} views</span>
            </SheetTitle>
            <SheetDescription className="sr-only">Choose a {mode.label} view</SheetDescription>
          </SheetHeader>

          {showFilter && (
            <div className="shrink-0 px-4 pb-2">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={`Filter ${mode.label} views…`}
                  aria-label={`Filter ${mode.label} views`}
                  className="h-11 pl-9 text-[15px]"
                />
              </div>
            </div>
          )}

          <div role="listbox" aria-label={`${mode.label} views`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
            {matches.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No view matches “{query}”.
              </p>
            )}
            {matches.map((tab, index) => {
              const Icon = tab.icon;
              const active = tab.id === activeTab.id;
              const section = viewSectionLabel(tab);
              const previousSection = index > 0 ? viewSectionLabel(matches[index - 1]) : undefined;
              return (
                <Fragment key={tab.id}>
                  {section && section !== previousSection && (
                    <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {section}
                    </p>
                  )}
                  <button
                    ref={active ? activeRef : undefined}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setOpen(false);
                      onSelectTab(tab.id);
                    }}
                    className={cn(
                      'flex min-h-touch w-full items-center gap-3 px-4 text-left text-[15px] transition-colors',
                      active
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-subtle-foreground active:bg-surface-2',
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                    {active && <Check className="size-4 shrink-0" aria-hidden="true" />}
                  </button>
                </Fragment>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
