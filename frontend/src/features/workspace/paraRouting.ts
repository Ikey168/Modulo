import { newParaId, type ParaData, type ParaInboxItem } from './para';

export type ParaDestination = 'task' | 'project' | 'area' | 'resource';

export function routeCapture(data: ParaData, item: ParaInboxItem, destination: ParaDestination): ParaData {
  const without = data.inbox.filter((candidate) => candidate.id !== item.id);
  if (destination === 'task') return { ...data, inbox: without, tasks: [{ id: newParaId('task'), title: item.title, status: 'Inbox', priority: 'P3', energy: 'Medium', context: item.detail, sourceId: item.sourceId }, ...data.tasks] };
  if (destination === 'project') return { ...data, inbox: without, projects: [{ id: newParaId('project'), name: item.title, outcome: item.detail ?? '', status: 'Idea', areaIds: [], priority: 'P3', sourceId: item.sourceId }, ...data.projects] };
  if (destination === 'area') return { ...data, inbox: without, areas: [{ id: newParaId('area'), name: item.title, category: 'Uncategorized', focus: 'Later', health: 'Growing', vision: item.detail ?? '', sourceId: item.sourceId }, ...data.areas] };
  return { ...data, inbox: without, resources: [{ id: newParaId('resource'), title: item.title, type: item.kind === 'Link' ? 'Source' : item.kind === 'Idea' ? 'Idea' : 'Note', status: 'Inbox', url: item.kind === 'Link' ? item.detail : undefined, content: item.kind !== 'Link' ? item.detail : undefined, projectIds: [], areaIds: [], sourceId: item.sourceId }, ...data.resources] };
}
