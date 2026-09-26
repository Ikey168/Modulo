import { useMemo } from 'react';
import { lifeStoreKey } from './lifeStore';
import { useWorkspaceStateRecords } from './useWorkspaceStateRecords';
import { mediaLibraryFromRecords } from './mediaLibraryStore';
import { useOperationalPortableSnapshot } from './operationalPortable';

const NAMESPACES = [
  'life-os',
  'personal-sops',
  'para',
  'routines',
  'meal-planner',
  'workout-planner',
  'education',
  'hobbies',
  'music',
  'electronics',
  'homelab',
  'wardrobe',
  'ttrpg',
  'business',
  'foundation-settings',
  'life-collections',
  'self-hosted-settings',
  'audit-pack',
  'quick-capture',
  'note-tree',
] as const;

const value = (
  records: ReturnType<typeof useWorkspaceStateRecords>,
  namespace: string,
  key: string,
): unknown => records[namespace]?.[key]?.value;

export function useLifeOsServerSnapshot(includeMedia = false): Record<string, unknown> {
  const operational = useOperationalPortableSnapshot();
  const records = useWorkspaceStateRecords(
    includeMedia ? [...NAMESPACES, 'media-library'] : [...NAMESPACES],
  );
  return useMemo(() => {
    const stores: Record<string, unknown> = { ...operational };
    const copy = (namespace: string, key: string, portableKey: string) => {
      const current = value(records, namespace, key);
      if (current !== undefined) stores[portableKey] = current;
    };

    copy('life-os', 'data', 'modulo-life-os-v1');
    copy('personal-sops', 'data', 'modulo-personal-sops-v1');
    copy('para', 'data', 'modulo-modified-para-v1');
    copy('routines', 'data', 'modulo-routines-habits-v1');
    copy('meal-planner', 'data', 'modulo-meal-planner-v2');
    copy('workout-planner', 'data', 'modulo-workout-planner-v1');
    if (includeMedia) {
      const media = mediaLibraryFromRecords(Object.values(records['media-library'] ?? {})).data;
      if (media.items.length) stores['modulo-media-library-v2'] = media;
    }
    copy('education', 'data', 'modulo-education-v1');
    copy('hobbies', 'data', 'modulo-hobbies-v1');
    copy('music', 'data', 'modulo-music-studio-v1');
    copy('electronics', 'data', 'modulo-electronics-workbench-v1');
    copy('homelab', 'data', 'modulo-homelab-v1');
    copy('wardrobe', 'data', 'modulo-wardrobe-v1');
    copy('ttrpg', 'data', 'modulo-ttrpg-v1');
    copy('business', 'data', 'modulo-business-admin-v1');
    copy('foundation-settings', 'fsrs-deck-limits', 'modulo-fsrs-deck-limits');
    copy('self-hosted-settings', 'settings', 'modulo-self-hosted-settings-v1');
    copy('audit-pack', 'onboarding', 'modulo:audit-onboarding:v1');
    copy('quick-capture', 'draft', 'modulo-quick-capture-v1');
    copy('note-tree', 'tree', 'modulo-note-tree');
    copy('note-tree', 'collapsed', 'modulo-note-collapsed');

    for (const [pluginId, record] of Object.entries(records['life-collections'] ?? {})) {
      if (!record.deleted && record.value !== undefined) stores[lifeStoreKey(pluginId)] = record.value;
    }
    return stores;
  }, [includeMedia, operational, records]);
}
