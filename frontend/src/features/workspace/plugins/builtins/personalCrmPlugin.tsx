import { ContactRound } from 'lucide-react';
import { PersonalCrmView } from '../../LifePluginViews';
import { createLifePlugin } from './lifePlugin';
const plugin = createLifePlugin('personal-crm', 'People', ContactRound, 80, 'People & Leisure', PersonalCrmView);
export default plugin;
