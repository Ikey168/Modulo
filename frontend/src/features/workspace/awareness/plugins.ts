import { Newspaper, Radar, Mail } from 'lucide-react';
import type { PluginModule, WorkspaceViewProps } from '../plugins/types';
import type { ComponentType } from 'react';
export const AWARENESS_PLUGINS = [
  { id: 'daily-briefing', name: 'Daily Briefing', desc: 'Scan feeds, newsletters, and web changes in one deduplicated queue with a 15-minute timer.', icon: Newspaper },
  { id: 'topic-watchlists', name: 'Topic Watchlists', desc: 'Watch keywords and phrases across your intake and link each watchlist to a PARA Area.', icon: Radar },
  { id: 'newsletter-inbox', name: 'Newsletter Inbox', desc: 'Import email files or paste newsletter issues, read them in Modulo, and save or archive them.', icon: Mail },
] as const;
export type AwarenessPluginId = typeof AWARENESS_PLUGINS[number]['id'];
const loaders: Record<AwarenessPluginId, () => Promise<{ default: ComponentType<WorkspaceViewProps> }>> = {
  'daily-briefing': () => import('./DailyBriefingView'),
  'topic-watchlists': () => import('./TopicWatchlistsView'),
  'newsletter-inbox': () => import('./NewsletterInboxView'),
};
export async function awarenessPlugin(id: AwarenessPluginId): Promise<PluginModule> {
  const definition = AWARENESS_PLUGINS.find(plugin => plugin.id === id)!; const module = await loaders[id]();
  return { activate(ctx) { ctx.addView({ id, label: definition.name, icon: definition.icon, mode: 'reading-capture', section: 'Awareness', order: 1 + AWARENESS_PLUGINS.findIndex(plugin => plugin.id === id), component: module.default }); } };
}
