// Workspace data is now served through @modulo/core (B4 #297).
// This file is kept as a re-export shim; prefer importing from useCoreWorkspace directly.
export { useCoreWorkspace as useWorkspaceData, type WorkspaceData } from './useCoreWorkspace';
