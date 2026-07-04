// Client-side blueprint store. Blueprints added by installing a marketplace
// pack live here (localStorage), layered over the backend-persisted blueprints
// so the editor lists and opens them without requiring a running backend.

import type { BlueprintIR } from './blueprintIR';
import type { BlueprintListItem, SavedBlueprint } from './blueprintService';

const KEY = 'modulo-local-blueprints';

export interface LocalBlueprint {
  name: string;
  description?: string;
  ir: BlueprintIR;
}

function load(): LocalBlueprint[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalBlueprint[]) : [];
  } catch {
    return [];
  }
}
function persist(list: LocalBlueprint[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full/unavailable — blueprints still apply for this session */
  }
}

/** Upsert blueprints by name (installing a pack twice does not duplicate). */
export function addLocalBlueprints(blueprints: LocalBlueprint[]): void {
  const byName = new Map(load().map((b) => [b.name, b]));
  for (const b of blueprints) byName.set(b.name, b);
  persist([...byName.values()]);
}

export function hasLocalBlueprint(name: string): boolean {
  return load().some((b) => b.name === name);
}

/** List entries in the shape the editor's saved-blueprint list expects. */
export function listLocalBlueprints(): BlueprintListItem[] {
  return load().map((b, i) => ({
    id: -1 - i, // negative ids never collide with backend rows
    name: b.name,
    description: b.description,
    version: 'pack',
    updatedAt: '',
  }));
}

/** Resolve a local blueprint by name for the editor's load flow. */
export function getLocalBlueprint(name: string): SavedBlueprint | undefined {
  const b = load().find((x) => x.name === name);
  if (!b) return undefined;
  return { id: -1, name: b.name, description: b.description, version: 'pack', ir: b.ir, createdAt: '', updatedAt: '' };
}
