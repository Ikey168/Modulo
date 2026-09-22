import { Palmtree } from 'lucide-react';
import { TravelPlannerView } from '../../LifePluginViews';
import { createLifePlugin } from './lifePlugin';
const plugin = createLifePlugin('travel-planner', 'Travel', Palmtree, 90, 'People & Leisure', TravelPlannerView);
export default plugin;
