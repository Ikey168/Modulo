import { ClipboardCheck } from 'lucide-react';
import { EducationAssignmentsView } from '../../EducationAssignmentsView';
import type { PluginModule } from '../types';

const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'education-assignments', label: 'Assignments', icon: ClipboardCheck, order: 43, mode: 'education', component: EducationAssignmentsView }); } };
export default plugin;
