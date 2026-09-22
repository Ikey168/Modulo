import { Link } from 'react-router-dom';
import type { NotePanelProps } from './plugins/types';
import { useWorkspaceIndex } from './useWorkspaceIndex';
import { entityPath } from './entityNavigation';

export function RecordBacklinksPanel({ note }: NotePanelProps) {
  const entities = useWorkspaceIndex();
  const matches = entities.filter(entity => entity.source !== 'Notes' && entity.noteIds?.includes(note.id));
  return <div className="space-y-2 text-sm">{matches.length ? matches.map(entity => <Link key={entity.uid} className="block underline" to={`/app/${entityPath(entity)}`}>{entity.title}<span className="block text-xs text-muted-foreground">{entity.source}</span></Link>) : <p className="text-muted-foreground">No records reference this note.</p>}</div>;
}
