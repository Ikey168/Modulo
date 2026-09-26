import type { CoreNote, CoreLink } from '@modulo/core';
import {
  parseLifeOsBackup,
  planLifeOsRestore,
  type LifeOsBackup,
} from './lifeOs';

export interface PortableStoreRestore {
  current: Record<string, unknown>;
  restoreServer: (stores: Record<string, unknown>) => Promise<string[]>;
}

/** Remap structured references only; ordinary note prose and specialist IDs stay intact. */
export function remapNoteReferences(
  value: unknown,
  ids: Map<number, number>,
  field = '',
): unknown {
  if (typeof value === 'string') {
    const uid = /^(core:notes:|note:)(\d+)$/.exec(value);
    if (uid && ['fromUid', 'toUid', 'source', 'uid'].includes(field)) {
      const id = ids.get(Number(uid[2]));
      if (id === undefined)
        throw new Error(
          `Backup references note ${uid[2]} without a matching exported note.`,
        );
      return `${uid[1]}${id}`;
    }
  }
  if (
    /^(sourceNoteId|targetNoteId|noteId|noteIds)$/.test(field) &&
    (typeof value === 'string' || typeof value === 'number') &&
    value !== ''
  ) {
    const id = ids.get(Number(value));
    if (id === undefined)
      throw new Error(
        `Backup references note ${value} without a matching exported note.`,
      );
    return typeof value === 'string' ? String(id) : id;
  }
  if (Array.isArray(value))
    return value.map((item) => remapNoteReferences(item, ids, field));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        remapNoteReferences(item, ids, key),
      ]),
    );
  return value;
}
export async function restoreWorkspaceBackup(
  backup: LifeOsBackup,
  existing: CoreNote[],
  createNote: (title: string, content: string) => Promise<CoreNote | null>,
  replace = false,
  operations?: {
    links: CoreLink[];
    createLink: (
      source: number,
      target: number,
      type: string,
    ) => Promise<boolean | void>;
    addTag: (id: number, name: string) => Promise<boolean | void>;
    trashNote: (id: number) => Promise<boolean | void>;
  },
  portable?: PortableStoreRestore,
) {
  backup = parseLifeOsBackup(backup);
  const currentStores = { ...(portable?.current ?? {}) };
  const plan = planLifeOsRestore(backup, currentStores, replace);
  const restorableKeys = new Set(plan.planned.map((item) => item.key));
  const ids = new Map<number, number>();
  const originals = new Set<number>();
  for (const note of backup.notes) {
    if (note.originalId === undefined) continue;
    if (originals.has(note.originalId))
      throw new Error('Duplicate original note IDs in backup.');
    originals.add(note.originalId);
  }
  // Validate every note reference before making any remote changes.
  const identity = new Map([...originals].map((id) => [id, id]));
  for (const { value } of plan.planned)
    remapNoteReferences(
      typeof value === 'string' ? JSON.parse(value) : value,
      identity,
    );
  remapNoteReferences(backup.links ?? [], identity);
  if (
    !operations &&
    (backup.links?.length ||
      backup.notes.some((note) => note.tags?.length || note.trashed))
  )
    throw new Error(
      'Note metadata restore operations are required for this backup.',
    );
  const available = [...existing];
  let importedNotes = 0;
  for (const note of backup.notes) {
    const index = available.findIndex(
      (item) =>
        item.title === note.title &&
        (item.markdownContent ?? item.content ?? '') === note.content,
    );
    let target = index >= 0 ? available.splice(index, 1)[0] : null;
    if (!target) {
      target = await createNote(note.title, note.content);
      if (!target)
        throw new Error(
          'Could not restore a note. Plugin stores were not changed. Retry to continue; matching notes are reused.',
        );
      importedNotes += 1;
    }
    if (note.originalId !== undefined) ids.set(note.originalId, target.id);
    for (const tag of note.tags ?? []) {
      if (
        !target.tags.some((item) => item.name === tag) &&
        (await operations?.addTag(target.id, tag)) === false
      )
        throw new Error('Could not restore note tags. Retry to continue.');
    }
    if (note.trashed && (await operations?.trashNote(target.id)) === false)
      throw new Error('Could not restore Trash. Retry to continue.');
  }
  const knownLinks = new Set(
    operations?.links.map(
      (link) => `${link.sourceNoteId}:${link.targetNoteId}:${link.linkType}`,
    ),
  );
  for (const link of backup.links ?? []) {
    const source = ids.get(link.sourceNoteId)!,
      target = ids.get(link.targetNoteId)!;
    const key = `${source}:${target}:${link.linkType}`;
    if (!knownLinks.has(key)) {
      if (
        (await operations?.createLink(source, target, link.linkType)) === false
      )
        throw new Error('Could not restore note links. Retry to continue.');
      knownLinks.add(key);
    }
  }
  const stores = Object.fromEntries(
    Object.entries(backup.stores).map(([key, value]) => {
      if (!restorableKeys.has(key)) return [key, value];
      if (key === 'modulo-note-tree' && value && typeof value === 'object') {
        return [
          key,
          Object.fromEntries(
            Object.entries(value)
              .filter(([id]) => ids.has(Number(id)))
              .map(([id, entry]) => {
                const item = entry as { parent: number | null; order: number };
                return [
                  String(ids.get(Number(id))),
                  {
                    ...item,
                    parent:
                      item.parent === null
                        ? null
                        : (ids.get(item.parent) ?? null),
                  },
                ];
              }),
          ),
        ];
      }
      if (key === 'modulo-note-collapsed' && Array.isArray(value))
        return [
          key,
          value
            .map((id) => ids.get(Number(id)))
            .filter((id) => id !== undefined),
        ];
      return [
        key,
        remapNoteReferences(
          typeof value === 'string' ? JSON.parse(value) : value,
          ids,
        ),
      ];
    }),
  );
  const planned = Object.fromEntries(
    plan.planned.map(({ key }) => [key, stores[key]]),
  );
  let serverRestored: string[] = [];
  if (Object.keys(planned).length) {
    if (!portable) {
      throw new Error(
        'This backup contains server plugin records, but no server restore adapter is available.',
      );
    }
    serverRestored = await portable.restoreServer(planned);
  }
  return {
    restored: serverRestored,
    skipped: plan.result.skipped,
    unknown: plan.result.unknown,
    importedNotes,
  };
}
