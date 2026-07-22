import { describe, expect, it } from 'vitest';
import { createCoreCatalog } from '../nodeCatalog';
import { NOESIS_NODES } from '../noesisNodes';
import { CAPABILITY_LABELS } from '../capabilities';

describe('noesis brief node', () => {
  it('descriptor is structurally valid and registers into the catalog', () => {
    const catalog = createCoreCatalog();
    for (const node of NOESIS_NODES) {
      expect(() => catalog.register(node)).not.toThrow();
    }
    expect(catalog.has('action.noesis.brief')).toBe(true);
  });

  it('declares network:noesis (mirrors backend NODE_CAPABILITY_MAP)', () => {
    for (const node of NOESIS_NODES) {
      expect(node.capability).toBe('network:noesis');
    }
  });

  it('capability has a human-readable label for the permissions UI', () => {
    expect(CAPABILITY_LABELS['network:noesis']?.label).toBeTruthy();
  });

  it('output pins match the backend interpreter outputs', () => {
    const brief = NOESIS_NODES.find((n) => n.type === 'action.noesis.brief')!;
    expect(brief.outputs.map((o) => o.id).sort()).toEqual(
      ['itemCount', 'markdown', 'status', 'title'],
    );
  });
});
