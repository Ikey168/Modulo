import { DomainDashboardView } from '../../DomainPackViews';
import { domainConfig, domainDefinition } from '../../domainConfigs';
import { LifeCollectionView } from '../../LifeCollectionView';
import type { PluginModule, WorkspaceViewProps } from '../types';

export function collectionPlugin(configId: string, mode: string, order: number): PluginModule {
  const config = domainConfig(configId);
  if (!config) throw new Error(`Unknown domain collection: ${configId}`);
  const view = () => <LifeCollectionView config={config} />;
  const parentViewId = undefined;
  return { activate(ctx) { ctx.addView({ id: config.id, label: shortLabel(config.title), icon: config.icon, order, mode, parentViewId, component: view }); } };
}

export function dashboardPlugin(domainId: string): PluginModule {
  const definition = domainDefinition(domainId);
  if (!definition) throw new Error(`Unknown domain dashboard: ${domainId}`);
  const view = (props: WorkspaceViewProps) => <DomainDashboardView domainId={domainId} {...props} />;
  const parentViewId = undefined;
  return { activate(ctx) { ctx.addView({ id: `${domainId}-dashboard`, label: 'Dashboard', icon: definition.icon, order: 10, mode: domainId, parentViewId, component: view }); } };
}

function shortLabel(title: string) { return title.replace('Accounts, Assets & Liabilities', 'Balance Sheet').replace('Roles, CVs & Accomplishments', 'Portfolio').replace('Submissions & Publishing', 'Publishing').replace('Permits & Transport Passes', 'Documents').replace('Keys, Backups & Recovery', 'Resilience').replace('Incidents & Procedures', 'Incidents').replace('Sources & Bibliography', 'Sources').replace('Claims & Evidence Map', 'Claims').replace('Reproducibility Records', 'Reproducibility').replace('Applications & Interviews', 'Opportunities').replace('Professional Development', 'Development').replace('Investments & Goals', 'Investments').replace('Mileage & Maintenance', 'Operations'); }
