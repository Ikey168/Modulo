import { describe, expect, it } from 'vitest';
import { createCoreCatalog } from '../nodeCatalog';
import { DIGEST_NODES, WEBHOOK_NODES } from '../auditAutomationNodes';

describe('audit automation nodes (#363)', () => {
  it('all descriptors are structurally valid and register into the catalog', () => {
    const catalog = createCoreCatalog();
    for (const node of [...WEBHOOK_NODES, ...DIGEST_NODES]) {
      expect(() => catalog.register(node)).not.toThrow();
    }
    expect(catalog.has('trigger.webhook')).toBe(true);
    expect(catalog.has('action.audit.reaudit')).toBe(true);
    expect(catalog.has('action.audit.digest')).toBe(true);
  });

  it('action nodes declare notes:write (mirrors backend NODE_CAPABILITY_MAP)', () => {
    for (const node of [...WEBHOOK_NODES, ...DIGEST_NODES]) {
      if (node.type.startsWith('action.')) {
        expect(node.capability).toBe('notes:write');
      } else {
        expect(node.capability).toBeUndefined();
      }
    }
  });

  it('the webhook trigger has no exec-in and outputs the payload', () => {
    const trigger = WEBHOOK_NODES.find((n) => n.type === 'trigger.webhook')!;
    expect(trigger.execIn).toBe(false);
    expect(trigger.outputs.map((o) => o.id)).toEqual(['payload']);
  });
});
