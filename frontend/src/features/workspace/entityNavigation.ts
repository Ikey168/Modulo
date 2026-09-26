import type { LifeOsEntity } from './lifeOs';
export const entityPath = (entity: LifeOsEntity) =>
  entity.path ?? (entity.source === 'Notes'
    ? `notes?note=${encodeURIComponent(entity.uid.slice('core:notes:'.length))}`
    : `${entity.route}?record=${encodeURIComponent(entity.uid)}`);
