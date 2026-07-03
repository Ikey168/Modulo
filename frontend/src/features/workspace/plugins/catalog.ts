// The plugin catalog: marketplace metadata (from plugins.ts) enriched with the
// runnable bits (version, dependencies, lazy loader) for the plugins that are
// actually implemented. Entries without a `load` are metadata-only and surface
// in the marketplace as "coming soon" — they cannot be installed.

import {
  DATABASE_PLUGIN_ID,
  GRAPH_PLUGIN_ID,
  NOTES_PLUGIN_ID,
  OUTLINE_PLUGIN_ID,
  PLUGINS,
} from '../plugins';
import type { PluginManifest, PluginModule } from './types';

interface Runnable {
  version: string;
  builtin?: boolean;
  dependencies?: string[];
  load: () => Promise<{ default: PluginModule }>;
}

// The four implemented plugins. Notes + Graph ship pre-installed; Outline and
// Databases extend the note view, so they depend on Markdown Notes.
const RUNNABLE: Record<string, Runnable> = {
  [NOTES_PLUGIN_ID]: {
    version: '1.2.0',
    builtin: true,
    load: () => import('./builtins/notesPlugin'),
  },
  [GRAPH_PLUGIN_ID]: {
    version: '1.1.0',
    builtin: true,
    load: () => import('./builtins/graphPlugin'),
  },
  [OUTLINE_PLUGIN_ID]: {
    version: '1.0.0',
    dependencies: [NOTES_PLUGIN_ID],
    load: () => import('./builtins/outlinePlugin'),
  },
  [DATABASE_PLUGIN_ID]: {
    version: '1.0.0',
    dependencies: [NOTES_PLUGIN_ID],
    load: () => import('./builtins/databasePlugin'),
  },
};

export const CATALOG: PluginManifest[] = PLUGINS.map((p) => {
  const runnable = RUNNABLE[p.id];
  return {
    id: p.id,
    name: p.name,
    version: runnable?.version ?? '0.1.0',
    author: p.author,
    description: p.desc,
    category: p.category,
    icon: p.icon,
    dependencies: runnable?.dependencies,
    builtin: runnable?.builtin,
    load: runnable?.load,
  };
});
