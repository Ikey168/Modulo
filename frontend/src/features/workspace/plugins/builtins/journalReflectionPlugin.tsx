import { NotebookPen } from 'lucide-react';
import { JournalReflectionView } from '../../LifePluginViews';
import { createLifePlugin } from './lifePlugin';
const plugin = createLifePlugin('journal-reflection', 'Journal', NotebookPen, 130, 'People & Leisure', JournalReflectionView);
export default plugin;
