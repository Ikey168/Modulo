// Workspace plugin runtime — the contribution vocabulary and manifest shape.
//
// This is the finer-grained, *user-installable* layer that sits inside the
// workspace shell. It complements (does not replace) the @modulo/core
// FeatureRegistry, which handles coarse app-experience packs mounted at boot.
// Here a "plugin" is something a user installs from the marketplace to add a
// view, a note-details panel, a markdown fence renderer, or an editor action.
//
// Isolation is the whole point: a plugin's code lives behind a lazy `load()`
// that is only called on activation, so a *not-installed* plugin is never
// fetched or evaluated — zero runtime cost, cannot execute, cannot throw.

import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { CoreLink, CoreNote } from '@modulo/core';
import type { WorkspaceData } from '../useCoreWorkspace';

// ── Props passed to contributed surfaces ─────────────────────────────────────

/** Superset of props the shell hands to any contributed workspace view. Each
 *  view uses the subset it needs (Notes uses editing/search, Graph uses links). */
export interface WorkspaceViewProps {
  data: WorkspaceData;
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onNewNote: () => void;
  onOpenNote: (id: number) => void;
  graphLinks: CoreLink[];
  navigateView: (view: string) => void;
  /** Aggregated contributions from all active plugins (e.g. so the notes view
   *  can render outline panels / database fences contributed by other plugins). */
  contributions: Contributions;
}

/** A section rendered in the note details panel (e.g. the document Outline). */
export interface NotePanelProps {
  note: CoreNote;
}

/** Renders a fenced ```lang block in a note (e.g. ```database). */
export interface NoteFenceProps {
  source: string;
}

/** Handed to an editor toolbar action when the user triggers it. */
export interface EditorActionRunCtx {
  insertAtCursor: (text: string) => void;
}

// ── Contribution descriptors ─────────────────────────────────────────────────

export interface ViewContribution {
  /** Route/view id, e.g. `'notes'` — also the `/app/:view` segment. */
  id: string;
  label: string;
  icon: LucideIcon;
  order: number;
  component: ComponentType<WorkspaceViewProps>;
}

export interface NotePanelContribution {
  id: string;
  title: string;
  order: number;
  component: ComponentType<NotePanelProps>;
}

export interface NoteFenceContribution {
  language: string;
  component: ComponentType<NoteFenceProps>;
}

export interface EditorActionContribution {
  id: string;
  label: string;
  icon: LucideIcon;
  run: (ctx: EditorActionRunCtx) => void;
}

/** Everything an active plugin has registered, aggregated across all plugins. */
export interface Contributions {
  views: ViewContribution[];
  notePanels: NotePanelContribution[];
  noteFences: NoteFenceContribution[];
  editorActions: EditorActionContribution[];
}

// ── Plugin module & manifest ─────────────────────────────────────────────────

/** The API a plugin's `activate` uses to register what it contributes. Every
 *  registration is tracked so uninstalling disposes exactly this plugin's
 *  contributions with no residue. */
export interface PluginContext {
  addView: (v: ViewContribution) => void;
  addNotePanel: (p: NotePanelContribution) => void;
  addNoteFence: (f: NoteFenceContribution) => void;
  addEditorAction: (a: EditorActionContribution) => void;
}

/** What a plugin's lazily-loaded code module exports. */
export interface PluginModule {
  activate: (ctx: PluginContext) => void | Promise<void>;
  /** Optional custom teardown; contribution disposal happens automatically. */
  deactivate?: () => void | Promise<void>;
}

/** Catalog entry. `load` is only invoked on activation → not-installed plugins
 *  are never fetched. A manifest with no `load` is metadata-only ("coming
 *  soon"): it appears in the marketplace but cannot be installed. */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: string;
  icon: string;
  /** Ids of other plugins that must be installed first. */
  dependencies?: string[];
  /** Pre-installed on a fresh vault. */
  builtin?: boolean;
  load?: () => Promise<PluginModule | { default: PluginModule }>;
}

/** True when a manifest can actually be installed (has runnable code). */
export function isRunnable(m: PluginManifest): boolean {
  return typeof m.load === 'function';
}

export type InstallPhase = 'idle' | 'installing' | 'uninstalling' | 'error';

export interface InstalledRecord {
  id: string;
  version: string;
  enabled: boolean;
}
