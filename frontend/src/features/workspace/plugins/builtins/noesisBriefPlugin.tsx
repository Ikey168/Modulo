// Noesis Brief — contributes the action.noesis.brief blueprint node: fetch
// the daily knowledge brief (news, economics, tech, web3, research
// publications) from a Noesis instance and feed it into note-creating
// automations.
import { NOESIS_NODES } from '../../../blueprint/noesisNodes';
import type { PluginModule } from '../types';

const noesisBriefPlugin: PluginModule = {
  activate(ctx) {
    for (const node of NOESIS_NODES) ctx.addBlueprintNode(node);
  },
};

export default noesisBriefPlugin;
