import { Button } from '@/ui';
import { Fact, FactGrid, RecordSheet } from './viewkit';
import { entityPath } from './entityNavigation';
import type { LifeOsEntity } from './lifeOs';
import { useLifeOsStore } from './useLifeOsStore';

export function WorkspaceRecordView({
  uid,
  entities,
  onClose,
  navigate,
}: {
  uid: string;
  entities: LifeOsEntity[];
  onClose: () => void;
  navigate: (path: string) => void;
}) {
  const entity = entities.find((item) => item.uid === uid);
  const record = entity?.record ?? null;
  const [lifeOs] = useLifeOsStore();
  const relations = lifeOs.relations.filter(
    (link) => link.fromUid === uid || link.toUid === uid,
  );
  return (
    <RecordSheet
      record={{ id: uid }}
      title={entity?.title || 'Record unavailable'}
      subtitle={entity ? `${entity.source} · ${entity.kind}` : undefined}
      onClose={onClose}
      actions={
        entity && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(entity.route)}
          >
            Open collection
          </Button>
        )
      }
    >
      {!entity || !record ? (
        <p role="status">
          This record was removed or is not available in the synchronized workspace.
        </p>
      ) : (
        <>
          <FactGrid>
            {Object.entries(record)
              .filter(([key]) => !['id', 'title', 'name'].includes(key))
              .map(([key, value]) => (
                <Fact
                  key={key}
                  label={label(key)}
                  wide={typeof value === 'object'}
                  value={<RecordValue value={value} />}
                />
              ))}
          </FactGrid>
          {relations.length > 0 && (
            <div className="mt-4 space-y-2">
              {relations.map((link) => {
                const target = entities.find(
                  (item) =>
                    item.uid ===
                    (link.fromUid === uid ? link.toUid : link.fromUid),
                );
                return (
                  <div
                    key={link.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span>{link.type}</span>
                    {target ? (
                      <Button
                        size="sm"
                        variant="link"
                        onClick={() => navigate(entityPath(target))}
                      >
                        {target.title}
                      </Button>
                    ) : (
                      <span>Missing record</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </RecordSheet>
  );
}
const label = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (value) => value.toUpperCase());
function RecordValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '')
    return <span>Not set</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (Array.isArray(value))
    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <RecordValue key={index} value={item} />
        ))}
      </div>
    );
  if (typeof value === 'object')
    return (
      <dl className="space-y-1">
        {Object.entries(value)
          .filter(([key]) => key !== 'id')
          .map(([key, item]) => (
            <div key={key}>
              <dt className="text-xs text-muted-foreground">{label(key)}</dt>
              <dd>
                <RecordValue value={item} />
              </dd>
            </div>
          ))}
      </dl>
    );
  return (
    <span className="whitespace-pre-wrap break-words">{String(value)}</span>
  );
}
