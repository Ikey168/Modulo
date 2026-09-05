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
  'plugins:install': {label:'Install plugins',description:'Use the pack’s pinned, provisioned plugins.'},
  'blueprints:write': {label:'Add workflow Blueprints',description:'Install workflow definitions and their triggers.'},
  'templates:write': {label:'Add note templates',description:'Install reusable note templates.'},
  'properties:schema': {label:'Add property schemas',description:'Install typed note-property definitions.'},
  'queries:write': {label:'Add saved queries',description:'Install property queries for workspace views.'},
  'workspace:configure': {label:'Add workspace views',description:'Install views and workspace modes.'},
  'dashboard:configure': {label:'Add dashboards',description:'Install dashboards composed from pack views.'},
  'permissions:request': {label:'Request permissions',description:'Present the pack’s permission presets for explicit consent.'},

  'approval:request': {label:'Human approval',description:'Request accountable decisions from the configured reviewer, sharing only the approval projection.'},
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
  'network:vies': {
    label: 'Network — VIES lookup',
    description: 'Validate VAT identification numbers against the EU VIES service.',
  },
  'network:noesis': {
    label: 'Noesis knowledge engine',
    description: 'Fetch the daily knowledge brief from your configured Noesis instance.',
  },
  'code:execute': {
    label: 'Custom Code — Execute',
    description:
      'Run sandboxed JavaScript in this blueprint. ' +
      'The script receives note fields (title, content) and returns a string. ' +
      'No Java, filesystem, or network access is available.',
  },
  'wasm:execute': {
    label: 'WASM Module — Execute',
    description:
      'Run a compiled WebAssembly module in this blueprint. ' +
      'The module receives note fields (title, content) and returns a string. ' +
      'Modules are pure compute: no imports, no filesystem or network access, ' +
      'hard memory and CPU limits.',
  },
};

export function capabilityLabel(cap: string): string {
  return CAPABILITY_LABELS[cap]?.label ?? cap;
}

export function capabilityDescription(cap: string): string {
  return CAPABILITY_LABELS[cap]?.description ?? '';
}
