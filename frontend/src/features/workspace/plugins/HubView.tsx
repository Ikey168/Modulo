// Hub container for a workspace mode (#369): a secondary sidebar beside the
// content area, one item per view contributed to the mode. The active item id
// is the route's view id, so `/app/:view` URLs keep working unchanged.
import { Fragment, useEffect, useState } from 'react';
import { usePlugins } from './PluginProvider';
import { cn } from '@/ui';
import { PluginErrorBoundary } from './PluginErrorBoundary';
import { viewSectionLabel, type ModeInfo } from './modes';
import { HubViewPicker } from '../mobile/HubViewPicker';
import { usePhoneScreen } from '../mobile/phoneScreen';
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
  const { preferences } = usePlugins();
  const [syncError, setSyncError] = useState<string>();
  // A view showing a full-screen detail owns the phone screen: the strip of
  // sibling views is about somewhere else, and it was costing a bar's height
  // above the note you had opened.
  const immersive = usePhoneScreen();
  // Remember the tab in the current account's settings namespace.
  useEffect(() => {
    let disposed = false;
    if (preferences && preferences.status !== 'closed' && preferences.get(`tab.${mode.id}`)?.value !== activeTab.id) {
      void preferences.set(`tab.${mode.id}`, activeTab.id, 'modulo.workspace.hub-tab', 1)
        .catch(reason => { if (!disposed) setSyncError(String(reason)); });
    }
    return () => { disposed = true; };
  }, [mode.id, activeTab.id, preferences]);

  const ActiveComponent = activeTab.component;
  const ModeIcon = mode.icon;
  const sectionCounts = new Map<string, number>();
  const sectionDashboards = new Map<string, ViewContribution>();
  for (const tab of tabs) {
    const section = viewSectionLabel(tab);
    if (!section) continue;
    sectionCounts.set(section, (sectionCounts.get(section) ?? 0) + 1);
    if (tab.label === 'Dashboard') sectionDashboards.set(section, tab);
  }
  // Once a hub shows any section heading, show every heading: a single-tab section without one
  // would visually fall under the previous section (e.g. Video games under "Listened").
  const anyHeading = mode.id === 'knowledge' || sectionDashboards.size > 0 || [...sectionCounts.values()].some((count) => count > 1);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col sm:flex-row">
      {syncError && <span role="alert">{syncError}</span>}
      {!immersive && <HubViewPicker mode={mode} tabs={tabs} activeTab={activeTab} onSelectTab={onSelectTab} />}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-border bg-surface/40 sm:flex">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 text-sm font-semibold">
          <ModeIcon className="size-3.5" aria-hidden="true" />
          {mode.label}
        </div>
        <nav
          role="tablist"
          aria-label={`${mode.label} views`}
          aria-orientation="vertical"
          className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2"
        >
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab.id;
            const section = viewSectionLabel(tab);
            const previous = tabs[index - 1];
            const previousSection = previous ? viewSectionLabel(previous) : undefined;
            const dashboard = section ? sectionDashboards.get(section) : undefined;
            const DashboardIcon = dashboard?.icon;
            const startsSection = Boolean(section && section !== previousSection);
            const showSection = Boolean(section && anyHeading);
            return (
              <Fragment key={tab.id}>
                {startsSection && showSection && (dashboard ? (
                  <button
                    type="button"
                    onClick={() => onSelectTab(dashboard.id)}
                    aria-current={dashboard.id === activeTab.id ? 'page' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2 px-2 pb-1 pt-2 text-left text-xxs font-semibold uppercase tracking-wider transition-colors',
                      index > 0 && 'mt-2 border-t border-border pt-3',
                      dashboard.id === activeTab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {DashboardIcon && <DashboardIcon className="size-3.5" aria-hidden="true" />}
                    <span className="truncate">{section}</span>
                  </button>
                ) : (
                  <span className={cn('px-2 pb-1 pt-2 text-xxs font-semibold uppercase tracking-wider text-muted-foreground', index > 0 && 'mt-2 border-t border-border pt-3')}>
                    {section}
                  </span>
                ))}
                {tab.label !== 'Dashboard' && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onSelectTab(tab.id)}
                    className={cn(
                      'flex h-8 w-full shrink-0 items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                )}
              </Fragment>
            );
          })}
        </nav>
      </aside>
      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <PluginErrorBoundary name={activeTab.label}>
          <ActiveComponent {...viewProps} />
        </PluginErrorBoundary>
      </div>
    </div>
  );
}
