import { beforeEach, describe, expect, it } from 'vitest';
import { IR_VERSION, type BlueprintIR } from '../blueprintIR';
import { addLocalBlueprints, getLocalBlueprint, hasLocalBlueprint, listLocalBlueprints } from '../localBlueprints';

const ir = (name: string): BlueprintIR => ({
  irVersion: IR_VERSION,
  nodes: [],
  edges: [],
  metadata: { name, createdAt: '', updatedAt: '' },
});

beforeEach(() => localStorage.clear());

describe('localBlueprints', () => {
  it('adds and lists blueprints', () => {
    addLocalBlueprints([
      { name: 'A', ir: ir('A') },
      { name: 'B', description: 'b', ir: ir('B') },
    ]);
    expect(listLocalBlueprints().map((b) => b.name).sort()).toEqual(['A', 'B']);
    expect(hasLocalBlueprint('A')).toBe(true);
    expect(hasLocalBlueprint('Z')).toBe(false);
  });

  it('upserts by name so installing a pack twice does not duplicate', () => {
    addLocalBlueprints([{ name: 'A', ir: ir('A') }]);
    addLocalBlueprints([{ name: 'A', description: 'updated', ir: ir('A') }]);
    expect(listLocalBlueprints().filter((b) => b.name === 'A')).toHaveLength(1);
    expect(getLocalBlueprint('A')?.description).toBe('updated');
  });

  it('resolves a blueprint by name for the editor load flow', () => {
    addLocalBlueprints([{ name: 'A', ir: ir('A') }]);
    expect(getLocalBlueprint('A')?.ir.metadata.name).toBe('A');
    expect(getLocalBlueprint('missing')).toBeUndefined();
  });
});
