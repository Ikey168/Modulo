import { GraduationCap } from 'lucide-react';
import { EducationCoreView } from '../../EducationCoreView';
import type { PluginModule } from '../types';

const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'education-core', label: 'Learning', icon: GraduationCap, order: 40, mode: 'education', component: EducationCoreView }); } };
export default plugin;
