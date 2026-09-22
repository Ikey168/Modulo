import { ListTodo } from 'lucide-react';
import { ParaTasksView } from '../../ParaTasksView';
import type { PluginModule } from '../types';
const plugin: PluginModule = { activate(ctx) { ctx.addView({ id: 'para-tasks', label: 'Tasks', icon: ListTodo, order: 42, mode: 'para', component: ParaTasksView }); } };
export default plugin;
