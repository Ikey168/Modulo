import { CalendarClock } from 'lucide-react';
import { EducationStudyPlannerView } from '../EducationStudyPlannerView';
import type { PluginModule } from '../../../features/workspace/plugins/types';

const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'education-study', label: 'Study', icon: CalendarClock, order: 42, mode: 'education', component: EducationStudyPlannerView }); } };
export default plugin;
