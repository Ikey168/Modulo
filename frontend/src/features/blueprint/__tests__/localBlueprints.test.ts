import { describe, expect, it } from 'vitest';
import { IR_VERSION, type BlueprintIR } from '../blueprintIR';
import {
  addLocalBlueprints,
  getLocalBlueprint,
  hasLocalBlueprint,
  listLocalBlueprints,
  parseLocalBlueprints,
  type LocalBlueprint,
} from '../localBlueprints';

const ir = (name: string): BlueprintIR => ({
  irVersion: IR_VERSION,
  nodes: [],
  edges: [],
  metadata: { name, createdAt: '', updatedAt: '' },
});

describe('localBlueprints', () => {
  it('adds and lists blueprints', () => {
    const list = addLocalBlueprints([], [
      { name: 'A', ir: ir('A') },
      { name: 'B', description: 'b', ir: ir('B') },
    ]);
    expect(listLocalBlueprints(list).map((b) => b.name).sort()).toEqual(['A', 'B']);
    expect(hasLocalBlueprint(list, 'A')).toBe(true);
    expect(hasLocalBlueprint(list, 'Z')).toBe(false);
  });

  it('upserts by name so installing a pack twice does not duplicate', () => {
    let list: LocalBlueprint[] = addLocalBlueprints([], [{ name: 'A', ir: ir('A') }]);
    list = addLocalBlueprints(list, [{ name: 'A', description: 'updated', ir: ir('A') }]);
    expect(listLocalBlueprints(list).filter((b) => b.name === 'A')).toHaveLength(1);
    expect(getLocalBlueprint(list, 'A')?.description).toBe('updated');
  });

  it('resolves a blueprint by name for the editor load flow', () => {
    const list = addLocalBlueprints([], [{ name: 'A', ir: ir('A') }]);
    expect(getLocalBlueprint(list, 'A')?.ir.metadata.name).toBe('A');
    expect(getLocalBlueprint(list, 'missing')).toBeUndefined();
  });

  it('parses server records and drops malformed entries', () => {
    const list = [{ name: 'A', ir: ir('A') }, { name: 3 }, { ir: ir('X') }, null];
    expect(parseLocalBlueprints(JSON.parse(JSON.stringify(list))).map((b) => b.name)).toEqual(['A']);
    expect(parseLocalBlueprints('nope')).toEqual([]);
  });
});
