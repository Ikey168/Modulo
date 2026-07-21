// Scheduled Digest (#363) — implements the `scheduled-digest` marketplace
// entry: contributes the Findings Status Digest action to the blueprint
// palette. Combine with the core On Schedule trigger for a recurring
// engagement status summary; delivery beyond the vault (email/post) is a
// follow-up.
import { DIGEST_NODES } from '../../../blueprint/auditAutomationNodes';
import type { PluginModule } from '../types';

const scheduledDigestPlugin: PluginModule = {
  activate(ctx) {
    for (const node of DIGEST_NODES) ctx.addBlueprintNode(node);
  },
};

export default scheduledDigestPlugin;
