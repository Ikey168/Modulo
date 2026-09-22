import { PackageSearch } from 'lucide-react';
import { HomeInventoryView } from '../../LifePluginViews';
import { createLifePlugin } from './lifePlugin';
const plugin = createLifePlugin('home-inventory', 'Inventory', PackageSearch, 60, 'Home & Wellbeing', HomeInventoryView);
export default plugin;
