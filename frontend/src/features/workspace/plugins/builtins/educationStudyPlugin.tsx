import { CalendarClock } from 'lucide-react';
import { EducationStudyPlannerView } from '../../EducationStudyPlannerView';
import type { PluginModule } from '../types';

const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'education-study', label: 'Study', icon: CalendarClock, order: 42, mode: 'education', component: EducationStudyPlannerView }); } };
export default plugin;
