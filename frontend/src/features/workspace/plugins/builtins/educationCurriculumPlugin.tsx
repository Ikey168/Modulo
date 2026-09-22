import { ListTree } from 'lucide-react';
import { EducationCurriculumView } from '../../EducationCurriculumView';
import type { PluginModule } from '../types';

const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'education-curriculum', label: 'Curriculum', icon: ListTree, order: 41, mode: 'education', component: EducationCurriculumView }); } };
export default plugin;
