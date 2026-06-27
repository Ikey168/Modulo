import type { FeaturePack, ModuloCoreAPI } from '@modulo/core';
import { lazy } from 'react';

// Route component lazy-loaded so this file imports nothing outside @modulo/core
// and react (satisfying the "no workspace-internal imports" contract for packs).
const WorkspaceComponent = lazy(() => import('../workspace/Workspace'));

let _api: ModuloCoreAPI | null = null;

/**
 * note-workbench — the PKM experience pack.
 *
 * Bundles: markdown editor, [[link]] parser, D3-force canvas graph,
 * Sigma/Graphology graph, and the Notes + Graph routes.
 *
 * Explicitly excluded (app-shell concerns): Dashboard, Marketplace.
 *
 * When this pack is not registered the rest of the app (auth, blueprints,
 * public share links, etc.) continues to run headlessly — Blueprint triggers
 * fire and the CoreAPIImpl is fully operational without any UI mounted.
 */
export const noteWorkbenchPack: FeaturePack = {
  id: 'com.modulo.note-workbench',
  name: 'Note Workbench',
  version: '0.1.0',

  capabilities: ['notes:write'],

  routes: [
    {
      path: '/app/:view',
      component: WorkspaceComponent,
      requiresAuth: true,
    },
  ],

  async onMount(api: ModuloCoreAPI): Promise<void> {
    _api = api;
    // Declare write intent up-front so the shell can surface a consent prompt
    // before the first mutation. Backend enforces grants independently.
    await api.requestCapabilities(['notes:write']);
  },

  async onUnmount(): Promise<void> {
    _api = null;
  },
};

/** Returns the live ModuloCoreAPI instance held by this pack, or null if unmounted. */
export function getNoteWorkbenchApi(): ModuloCoreAPI | null {
  return _api;
}
