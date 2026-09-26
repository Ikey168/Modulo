import { MapPinned } from 'lucide-react';
import { PlacesLibraryView } from '../../LifePluginViews';
import { createLifePlugin } from './lifePlugin';
const plugin = createLifePlugin('places-library', 'Places', MapPinned, 120, 'People & Leisure', PlacesLibraryView);
export default plugin;
