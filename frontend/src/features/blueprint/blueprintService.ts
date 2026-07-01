// Blueprint persistence service (#272): save/load blueprints via the backend
// plugin_registry (runtime = 'BLUEPRINT'). Version history is tracked by the
// backend in plugin_config_history on every PUT.

import { BlueprintIR } from './blueprintIR';

const API = '/api/blueprints';

export interface SavedBlueprint {
  id: number;
  name: string;
  description?: string;
  version: string;
  ir: BlueprintIR;
  createdAt: string;
  updatedAt: string;
}

export interface BlueprintListItem {
  id: number;
  name: string;
  description?: string;
  version: string;
  updatedAt: string;
}

export interface BlueprintSaveRequest {
  name: string;
  description?: string;
  version?: string;
  ir: BlueprintIR;
}

export interface BlueprintUpdateRequest {
  ir: BlueprintIR;
  changeReason?: string;
}

export async function saveBlueprint(req: BlueprintSaveRequest): Promise<SavedBlueprint> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Failed to save blueprint: ${res.statusText}`);
  return res.json() as Promise<SavedBlueprint>;
}

export async function loadBlueprint(name: string): Promise<SavedBlueprint> {
  const res = await fetch(`${API}/${encodeURIComponent(name)}`);
  if (res.status === 404) throw new Error(`Blueprint not found: ${name}`);
  if (!res.ok) throw new Error(`Failed to load blueprint: ${res.statusText}`);
  return res.json() as Promise<SavedBlueprint>;
}

export async function updateBlueprint(name: string, req: BlueprintUpdateRequest): Promise<SavedBlueprint> {
  const res = await fetch(`${API}/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (res.status === 404) throw new Error(`Blueprint not found: ${name}`);
  if (!res.ok) throw new Error(`Failed to update blueprint: ${res.statusText}`);
  return res.json() as Promise<SavedBlueprint>;
}

export async function listBlueprints(): Promise<BlueprintListItem[]> {
  const res = await fetch(API);
  if (!res.ok) throw new Error(`Failed to list blueprints: ${res.statusText}`);
  return res.json() as Promise<BlueprintListItem[]>;
}

// ---- Permissions / capabilities (#275) ------------------------------------

export interface BlueprintPermission {
  capability: string;
  granted: boolean;
}

export async function getBlueprintPermissions(name: string): Promise<BlueprintPermission[]> {
  const res = await fetch(`${API}/${encodeURIComponent(name)}/permissions`);
  if (res.status === 404) throw new Error(`Blueprint not found: ${name}`);
  if (!res.ok) throw new Error(`Failed to load permissions: ${res.statusText}`);
  return res.json() as Promise<BlueprintPermission[]>;
}

export async function setBlueprintPermission(
  name: string,
  capability: string,
  granted: boolean,
): Promise<void> {
  const res = await fetch(`${API}/${encodeURIComponent(name)}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ capability, granted }),
  });
  if (res.status === 404) throw new Error(`Blueprint or capability not found`);
  if (!res.ok) throw new Error(`Failed to update permission: ${res.statusText}`);
}

export interface BlueprintExecution {
  executionType: string;
  status: 'success' | 'error' | 'timeout' | string;
  message?: string;
  /** Node ids that executed, in order — used to highlight the path in the editor. */
  executedNodes?: string[];
  executionTimeMs?: number;
  createdAt: string;
}

export async function getBlueprintExecutions(name: string, limit = 20): Promise<BlueprintExecution[]> {
  const res = await fetch(`${API}/${encodeURIComponent(name)}/executions?limit=${limit}`);
  if (res.status === 404) throw new Error(`Blueprint not found: ${name}`);
  if (!res.ok) throw new Error(`Failed to load executions: ${res.statusText}`);
  return res.json() as Promise<BlueprintExecution[]>;
}

export async function deleteBlueprint(name: string): Promise<void> {
  const res = await fetch(`${API}/${encodeURIComponent(name)}`, { method: 'DELETE' });
  if (res.status === 404) throw new Error(`Blueprint not found: ${name}`);
  if (!res.ok) throw new Error(`Failed to delete blueprint: ${res.statusText}`);
}
