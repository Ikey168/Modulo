// The plugin catalog: marketplace metadata (from plugins.ts) enriched with the
// runnable bits (dependencies, lazy loader) for the plugins that are actually
// implemented. Entries without a `load` are metadata-only and surface in the
// marketplace as "coming soon" — they cannot be installed.

import {
  CANVAS_PLUGIN_ID,
  DATABASE_PLUGIN_ID,
  GRAPH_PLUGIN_ID,
  NOTES_PLUGIN_ID,
  OUTLINE_PLUGIN_ID,
  PLUGINS,
} from '../plugins';
import type { PluginManifest, PluginModule } from './types';

interface Runnable {
  builtin?: boolean;
  dependencies?: string[];
  load: () => Promise<{ default: PluginModule }>;
}

// The four implemented plugins. Notes + Graph ship pre-installed; Outline and
// Databases extend the note view, so they depend on Markdown Notes.
const RUNNABLE: Record<string, Runnable> = {
  [NOTES_PLUGIN_ID]: {
    builtin: true,
    load: () => import('./builtins/notesPlugin'),
  },
  [GRAPH_PLUGIN_ID]: {
    builtin: true,
    load: () => import('./builtins/graphPlugin'),
  },
  [OUTLINE_PLUGIN_ID]: {
    dependencies: [NOTES_PLUGIN_ID],
    load: () => import('./builtins/outlinePlugin'),
  },
  [DATABASE_PLUGIN_ID]: {
    dependencies: [NOTES_PLUGIN_ID],
    load: () => import('./builtins/databasePlugin'),
  },
  [CANVAS_PLUGIN_ID]: {
    load: () => import('./builtins/canvasPlugin'),
  },
};

export const CATALOG: PluginManifest[] = PLUGINS.map((p) => {
  const runnable = RUNNABLE[p.id];
  return {
    id: p.id,
    name: p.name,
    description: p.desc,
    category: p.category,
    icon: p.icon,
    dependencies: runnable?.dependencies,
    builtin: runnable?.builtin,
    load: runnable?.load,
  };
});
