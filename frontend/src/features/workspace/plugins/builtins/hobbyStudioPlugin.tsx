import { Sparkles } from 'lucide-react';
import { HobbyStudioView } from '../../LifePluginViews';
import { createLifePlugin } from './lifePlugin';
const plugin = createLifePlugin('hobby-studio', 'Hobbies', Sparkles, 100, 'People & Leisure', HobbyStudioView);
export default plugin;
