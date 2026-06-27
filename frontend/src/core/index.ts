// @modulo/core — the ONLY import path for feature packs (#294).
//
// Usage in a pack:
//
//   import { createCoreAPI, type ModuloCoreAPI, type CoreNote } from '@modulo/core';
//
//   const api = createCoreAPI();
//   await api.requestCapabilities(['notes:write']);
//   const notes = await api.notes();
//
// This barrel intentionally re-exports no React, editor, or graph-view types.
// If you find yourself importing something UI-specific through here, it belongs
// in the pack itself — not in core.

export { CoreAPIImpl } from './CoreAPIImpl';
export type { ModuloCoreAPI } from './ModuloCoreAPI';

export type {
  BlueprintInvokeOptions,
  BlueprintListItem,
  CoreCapability,
  CoreEventListener,
  CoreEventType,
  CoreLink,
  CoreNote,
  CoreTag,
  GraphEdgeData,
  GraphNodeData,
  GraphQueryResult,
  Unsubscribe,
} from './types';

// Pure graph utilities — exported so packs can run the same queries client-side
// on data already fetched via api.graph() or api.notes() + api.links().
export { buildGraph, filterGraphByTags, neighbours, subgraph } from './graphQueries';

// Factory: create a ModuloCoreAPI instance.
// Each pack should call this once and hold the result for its lifetime.
// The instance carries its own capability grant set and event subscriptions.
import { CoreAPIImpl } from './CoreAPIImpl';
import type { ModuloCoreAPI } from './ModuloCoreAPI';

export function createCoreAPI(): ModuloCoreAPI {
  return new CoreAPIImpl();
}
