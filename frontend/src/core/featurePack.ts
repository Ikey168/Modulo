import type { ComponentType } from 'react';
import type { CoreCapability } from './types';
import type { ModuloCoreAPI } from './ModuloCoreAPI';

/** A route contributed by a feature pack. The host renders `<Component />` at `path`. */
export interface RouteContribution {
  path: string;
  component: ComponentType;
  requiresAuth?: boolean;
}

/** A UI panel or widget contributed to a named slot in the shell layout. */
export interface ViewContribution {
  /** Slot name — e.g. `'sidebar'`, `'panel'`, `'statusbar'`. */
  slot: string;
  component: ComponentType;
}

/** A contribution to a named editor toolbar or surface. */
export interface EditorSurfaceContribution {
  /** Surface name — e.g. `'toolbar'`, `'statusbar'`. */
  surface: string;
  component: ComponentType;
}

/** A command palette / keyboard-shortcut entry. */
export interface CommandContribution {
  id: string;
  label: string;
  keybinding?: string;
  execute: (api: ModuloCoreAPI) => void | Promise<void>;
}

/**
 * A feature-pack descriptor.
 *
 * Packs declare what capabilities they need and what they contribute
 * (routes, views, commands, editor surfaces).  The host calls
 * `onMount(api)` once capability grants are in place and
 * `onUnmount()` when the pack is torn down.
 */
export interface FeaturePack {
  /** Reverse-domain unique identifier, e.g. `'com.modulo.notes'`. */
  id: string;
  name: string;
  version: string;

  /** Capabilities this pack requires before mounting. */
  capabilities: CoreCapability[];

  routes?: RouteContribution[];
  views?: ViewContribution[];
  editorSurfaces?: EditorSurfaceContribution[];
  commands?: CommandContribution[];

  /** Called once after the app shell grants the declared capabilities. */
  onMount?: (api: ModuloCoreAPI) => void | Promise<void>;
  /** Called when the pack is being torn down (app unmount or hot-reload). */
  onUnmount?: () => void | Promise<void>;
}
