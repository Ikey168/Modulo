// Tax Automation (#367) — contributes the German tax-rhythm nodes to the
// blueprint palette: USt-VA/ZM deadline reminders, overdue-invoice chasing
// (drafts only), and VIES USt-IdNr validation.
import { TAX_NODES } from '../../../blueprint/taxAutomationNodes';
import type { PluginModule } from '../types';

const taxAutomationPlugin: PluginModule = {
  activate(ctx) {
    for (const node of TAX_NODES) ctx.addBlueprintNode(node);
  },
};

export default taxAutomationPlugin;
