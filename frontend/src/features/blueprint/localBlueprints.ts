// Blueprints added by installing a marketplace pack. They are stored as
// workspace state on the server (not in the browser) and layered over the
// backend-persisted blueprints so the editor lists and opens them.

import type { BlueprintIR } from './blueprintIR';
import type { BlueprintListItem, SavedBlueprint } from './blueprintService';
import { useServerWorkspaceStore } from '../workspace/useWorkspaceStore';

const LEGACY_KEY = 'modulo-local-blueprints';

export interface LocalBlueprint {
  name: string;
  description?: string;
  ir: BlueprintIR;
}

export function parseLocalBlueprints(value: unknown): LocalBlueprint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (typeof raw !== 'object' || raw === null) return [];
    const item = raw as Record<string, unknown>;
    if (typeof item.name !== 'string' || typeof item.ir !== 'object' || item.ir === null) return [];
    return [{ name: item.name, ...(typeof item.description === 'string' ? { description: item.description } : {}), ir: item.ir as BlueprintIR }];
  });
}

/** Server-backed pack blueprints for the signed-in account. */
export function usePackBlueprints() {
  return useServerWorkspaceStore<LocalBlueprint[]>(
    'blueprint-packs', 'blueprints', 'modulo.workspace.pack-blueprints', [],
    parseLocalBlueprints, LEGACY_KEY, 'Pack blueprints');
}

/** Upsert blueprints by name (installing a pack twice does not duplicate). */
export function addLocalBlueprints(current: LocalBlueprint[], blueprints: LocalBlueprint[]): LocalBlueprint[] {
  const byName = new Map(current.map((b) => [b.name, b]));
  for (const b of blueprints) byName.set(b.name, b);
  return [...byName.values()];
}

export function hasLocalBlueprint(current: LocalBlueprint[], name: string): boolean {
  return current.some((b) => b.name === name);
}

/** List entries in the shape the editor's saved-blueprint list expects. */
export function listLocalBlueprints(current: LocalBlueprint[]): BlueprintListItem[] {
  return current.map((b, i) => ({
    id: -1 - i, // negative ids never collide with backend rows
    name: b.name,
    description: b.description,
    version: 'pack',
    updatedAt: '',
  }));
}

/** Resolve a pack blueprint by name for the editor's load flow. */
export function getLocalBlueprint(current: LocalBlueprint[], name: string): SavedBlueprint | undefined {
  const b = current.find((x) => x.name === name);
  if (!b) return undefined;
  return { id: -1, name: b.name, description: b.description, version: 'pack', ir: b.ir, createdAt: '', updatedAt: '' };
}
