// The plugin catalog: marketplace metadata (from plugins.ts) enriched with the
// runnable bits (dependencies, lazy loader) for the plugins that are actually
// implemented. Entries without a `load` are metadata-only and surface in the
// marketplace as "coming soon" — they cannot be installed.

import {
  CALENDAR_PLUGIN_ID,
  CANVAS_PLUGIN_ID,
  CHECKLISTS_PLUGIN_ID,
  DATABASE_PLUGIN_ID,
  EUER_PLUGIN_ID,
  FINDINGS_PLUGIN_ID,
  GOBD_PLUGIN_ID,
  GRAPH_PLUGIN_ID,
  NOTES_PLUGIN_ID,
  OUTLINE_PLUGIN_ID,
  PLUGINS,
  RECHNUNG_PLUGIN_ID,
  REPORTS_PLUGIN_ID,
  SAVED_SEARCHES_PLUGIN_ID,
  TAGS_PLUGIN_ID,
  TIMELINE_PLUGIN_ID,
  VULN_KB_PLUGIN_ID,
  ZEITERFASSUNG_PLUGIN_ID,
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
  [CALENDAR_PLUGIN_ID]: {
    load: () => import('./builtins/calendarPlugin'),
  },
  [TIMELINE_PLUGIN_ID]: {
    load: () => import('./builtins/timelinePlugin'),
  },
  [TAGS_PLUGIN_ID]: {
    load: () => import('./builtins/tagExplorerPlugin'),
  },
  [SAVED_SEARCHES_PLUGIN_ID]: {
    load: () => import('./builtins/savedSearchesPlugin'),
  },
  [FINDINGS_PLUGIN_ID]: {
    dependencies: [NOTES_PLUGIN_ID],
    load: () => import('./builtins/findingsPlugin'),
  },
  kanban: {
    load: () => import('./builtins/kanbanPlugin'),
  },
  [CHECKLISTS_PLUGIN_ID]: {
    dependencies: [NOTES_PLUGIN_ID],
    load: () => import('./builtins/checklistsPlugin'),
  },
  [VULN_KB_PLUGIN_ID]: {
    dependencies: [FINDINGS_PLUGIN_ID],
    load: () => import('./builtins/vulnKbPlugin'),
  },
  [REPORTS_PLUGIN_ID]: {
    dependencies: [FINDINGS_PLUGIN_ID],
    load: () => import('./builtins/reportsPlugin'),
  },
  [RECHNUNG_PLUGIN_ID]: {
    dependencies: [NOTES_PLUGIN_ID],
    load: () => import('./builtins/rechnungPlugin'),
  },
  [ZEITERFASSUNG_PLUGIN_ID]: {
    load: () => import('./builtins/zeiterfassungPlugin'),
  },
  [EUER_PLUGIN_ID]: {
    dependencies: [RECHNUNG_PLUGIN_ID],
    load: () => import('./builtins/euerPlugin'),
  },
  [GOBD_PLUGIN_ID]: {
    load: () => import('./builtins/gobdPlugin'),
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
