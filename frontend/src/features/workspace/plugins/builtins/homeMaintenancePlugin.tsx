import { Home } from 'lucide-react';
import { HomeMaintenanceView } from '../../LifePluginViews';
import { createLifePlugin } from './lifePlugin';
const plugin = createLifePlugin('home-maintenance', 'Home', Home, 50, 'Home & Wellbeing', HomeMaintenanceView);
export default plugin;
