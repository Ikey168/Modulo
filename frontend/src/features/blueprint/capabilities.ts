// Capability derivation for blueprint graphs (#275).
// Mirrors BlueprintCapabilityService.NODE_CAPABILITY_MAP on the backend so the
// editor can preview required permissions before the blueprint is saved.

import { NodeDescriptor } from './nodeModel';
import type { FlowNode } from './editor/reactFlowAdapter';

/**
 * Derive the set of capabilities required by the given canvas nodes.
 * Uses the `capability` field declared on each NodeDescriptor.
 */
export function deriveRequiredCapabilities(nodes: FlowNode[]): string[] {
  const caps = new Set<string>();
  for (const n of nodes) {
    const cap = (n.data.descriptor as NodeDescriptor).capability;
    if (cap) caps.add(cap);
  }
  return [...caps].sort();
}

/** Human-readable labels for known capabilities. */
export const CAPABILITY_LABELS: Record<string, { label: string; description: string }> = {
  'notes:write': {
    label: 'Notes — Write',
    description: 'Create and modify notes in your workspace.',
  },
  'blockchain:anchor': {
    label: 'Blockchain — Anchor',
    description: 'Write a content-hash fingerprint to the configured blockchain.',
  },
  'ai:invoke': {
    label: 'AI — Invoke',
    description: 'Send note content to the AI service for summarisation.',
  },
  'code:execute': {
    label: 'Custom Code — Execute',
    description:
      'Run sandboxed JavaScript in this blueprint. ' +
      'The script receives note fields (title, content) and returns a string. ' +
      'No Java, filesystem, or network access is available.',
  },
};

export function capabilityLabel(cap: string): string {
  return CAPABILITY_LABELS[cap]?.label ?? cap;
}

export function capabilityDescription(cap: string): string {
  return CAPABILITY_LABELS[cap]?.description ?? '';
}
