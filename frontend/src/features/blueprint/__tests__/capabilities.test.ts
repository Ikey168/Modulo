import { describe, it, expect } from 'vitest';
import { NOTES_NODES, createCoreCatalog } from '../nodeCatalog';
import { deriveRequiredCapabilities, capabilityLabel, capabilityDescription } from '../capabilities';
import type { FlowNode } from '../editor/reactFlowAdapter';

const catalog = createCoreCatalog();
// The note nodes used by these tests are contributed by the Notes plugin.
NOTES_NODES.forEach((n) => catalog.register(n));

function makeNode(type: string): FlowNode {
  const descriptor = catalog.get(type)!;
  return {
    id: 'n_' + type,
    type: 'blueprintNode',
    position: { x: 0, y: 0 },
    data: { descriptor, nodeVersion: descriptor.version },
  };
}

describe('deriveRequiredCapabilities', () => {
  it('returns empty for trigger and logic nodes', () => {
    expect(deriveRequiredCapabilities([
      makeNode('trigger.note.saved'),
      makeNode('logic.branch'),
    ])).toEqual([]);
  });

  it('derives a single capability from one action node', () => {
    expect(deriveRequiredCapabilities([makeNode('action.ai.summarize')])).toEqual(['ai:invoke']);
  });

  it('deduplicates capabilities from multiple nodes with the same requirement', () => {
    const nodes = [makeNode('action.note.create'), makeNode('action.tag.add')];
    expect(deriveRequiredCapabilities(nodes)).toEqual(['notes:write']);
  });

  it('collects all three distinct capabilities from a full pipeline', () => {
    const nodes = [
      makeNode('trigger.note.saved'),
      makeNode('action.ai.summarize'),
      makeNode('action.tag.add'),
      makeNode('action.note.anchor'),
    ];
    const caps = deriveRequiredCapabilities(nodes);
    expect(caps).toContain('ai:invoke');
    expect(caps).toContain('notes:write');
    expect(caps).toContain('blockchain:anchor');
    expect(caps).toHaveLength(3);
  });

  it('returns sorted results', () => {
    const nodes = [makeNode('action.note.anchor'), makeNode('action.ai.summarize')];
    const caps = deriveRequiredCapabilities(nodes);
    expect(caps).toEqual([...caps].sort());
  });
});

describe('capabilityLabel / capabilityDescription', () => {
  it('returns human label for known capabilities', () => {
    expect(capabilityLabel('notes:write')).toContain('Notes');
    expect(capabilityLabel('ai:invoke')).toContain('AI');
    expect(capabilityLabel('blockchain:anchor')).toContain('Blockchain');
  });

  it('falls back to the raw capability string for unknowns', () => {
    expect(capabilityLabel('some:unknown')).toBe('some:unknown');
  });

  it('returns a non-empty description for known capabilities', () => {
    expect(capabilityDescription('notes:write').length).toBeGreaterThan(0);
  });
});
