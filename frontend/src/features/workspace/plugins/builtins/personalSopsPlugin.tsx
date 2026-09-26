import { ClipboardCheck } from 'lucide-react';
import { PersonalSopsView } from '../../PersonalSopsView';
import type { PluginModule } from '../types';

const plugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'personal-sops', label: 'Personal SOPs', icon: ClipboardCheck, order: 35, mode: 'productivity', section: 'Procedures', component: PersonalSopsView });
  },
};
export default plugin;
