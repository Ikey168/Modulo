import { useContext } from 'react';
import { WorkspaceEntityContext } from './WorkspaceEntityContext';
import { entityPath } from './entityNavigation';
import { Link2 } from 'lucide-react';
import { Badge } from '@/ui';
import { relationsFor } from './lifeOs';
import { useLifeOsStore } from './useLifeOsStore';
import { useWorkspaceIndex } from './useWorkspaceIndex';

export function CrossPluginLinks({ uid }: { uid: string }) {
  const fallbackEntities = useWorkspaceIndex();
  const entities = useContext(WorkspaceEntityContext) ?? fallbackEntities;
  const byUid = new Map(entities.map((entity) => [entity.uid, entity]));
  const [lifeOs] = useLifeOsStore();
  const links = relationsFor(uid, lifeOs);
  if (!links.length) return null;
  const incoming = links.filter((item) => item.direction === 'incoming');
  const outgoing = links.filter((item) => item.direction === 'outgoing');
  return <section className="border-t border-border pt-4">
    <div className="mb-2 flex items-center gap-2"><Link2 className="size-4 text-muted-foreground"/><h3 className="text-sm font-semibold">Used by & linked records</h3><Badge variant="outline" className="ml-auto rounded-sm bg-transparent">{links.length}</Badge></div>
    <div className="divide-y divide-border border-y border-border">
      {[...incoming, ...outgoing].map(({ relation, direction }) => {
        const other = byUid.get(direction === 'incoming' ? relation.fromUid : relation.toUid);
        return <div key={relation.id} className="flex items-center gap-3 px-2 py-2 text-xs">
          <span className="w-20 shrink-0 text-muted-foreground">{direction === 'incoming' ? 'Used by' : relation.type}</span>
          {other ? <a className="min-w-0 flex-1 truncate font-medium underline underline-offset-2" href={`/app/${entityPath(other)}`}>{other.title}</a> : <span className="min-w-0 flex-1 truncate">Missing record</span>}
          <span className="shrink-0 text-muted-foreground">{other?.source ?? 'Broken link'}</span>
        </div>;
      })}
    </div>
  </section>;
}
