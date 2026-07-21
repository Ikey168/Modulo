// Webhook Trigger (#363) — implements the `webhook-trigger` marketplace entry:
// contributes the On Webhook trigger and the Create Re-audit Note action to
// the blueprint palette while installed. The backend endpoint lives at
// /api/public/blueprints/webhook/<blueprint>/<node>, guarded by the shared
// secret configured on the trigger node.
import { WEBHOOK_NODES } from '../../../blueprint/auditAutomationNodes';
import type { PluginModule } from '../types';

const webhookTriggerPlugin: PluginModule = {
  activate(ctx) {
    for (const node of WEBHOOK_NODES) ctx.addBlueprintNode(node);
  },
};

export default webhookTriggerPlugin;
