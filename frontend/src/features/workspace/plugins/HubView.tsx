// Hub container for a workspace mode (#369): a tab strip across the top of the
// content area, one tab per view contributed to the mode. The active tab id is
// the route's view id, so `/app/:view` URLs keep working unchanged.
import { useEffect } from 'react';
import { cn } from '@/ui';
import { PluginErrorBoundary } from './PluginErrorBoundary';
import { writeLastTab, type ModeInfo } from './modes';
import type { ViewContribution, WorkspaceViewProps } from './types';

export function HubView({
  mode,
  tabs,
  activeTab,
  viewProps,
  onSelectTab,
}: {
  mode: ModeInfo;
  tabs: ViewContribution[];
  activeTab: ViewContribution;
  viewProps: WorkspaceViewProps;
  onSelectTab: (viewId: string) => void;
}) {
  // Remember the tab so reopening the mode restores it.
  useEffect(() => {
    writeLastTab(mode.id, activeTab.id);
  }, [mode.id, activeTab.id]);

  const ActiveComponent = activeTab.component;
  const ModeIcon = mode.icon;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-3">
        <span className="mr-2 flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <ModeIcon className="size-3.5" aria-hidden="true" />
          {mode.label}
        </span>
        <div role="tablist" aria-label={`${mode.label} tabs`} className="flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectTab(tab.id)}
                className={cn(
                  'flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-[13px] transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  active
                    ? 'border-primary font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <PluginErrorBoundary name={activeTab.label}>
          <ActiveComponent {...viewProps} />
        </PluginErrorBoundary>
      </div>
    </div>
  );
}
