import { HeartPulse } from 'lucide-react';
import { HealthTrackerView } from '../../LifePluginViews';
import { createLifePlugin } from './lifePlugin';
const plugin = createLifePlugin('health-tracker', 'Health', HeartPulse, 40, 'Home & Wellbeing', HealthTrackerView);
export default plugin;
