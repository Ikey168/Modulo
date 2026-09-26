import type { StateJson } from './pluginStateClient';

/**
 * Record-level three-way merge for durable workspace documents.
 *
 * Whole-domain documents (PARA, hobbies, education, ...) hold collections of
 * records with stable `id`s. Two devices that edit different records, or
 * different fields of one record, must not force a whole-document choice
 * between "mine" and "theirs". This merge applies both sides' changes when
 * they do not overlap and reports a conflict when the same value changed on
 * both sides, so the existing conflict review still owns true conflicts.
 *
 * `undefined` means "absent" (a missing object key, a deleted record, or a
 * record that did not exist at the common base).
 */
export type MergeResult = { ok: true; value: StateJson | undefined } | { ok: false; path: string };

type Json = StateJson | undefined;
type Identified = { id: string | number } & { [key: string]: StateJson };

const isObject = (value: Json): value is { [key: string]: StateJson } =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isIdentified = (value: Json): value is Identified =>
  isObject(value) && (typeof value.id === 'string' || typeof value.id === 'number');
const identifiedArray = (value: Json): value is Identified[] => Array.isArray(value)
  && value.every(isIdentified)
  && new Set(value.map(item => `${typeof item.id}:${item.id}`)).size === value.length;
const primitiveArray = (value: Json): value is Array<string | number | boolean | null> => Array.isArray(value)
  && value.every(item => item === null || ['string', 'number', 'boolean'].includes(typeof item));

function canonical(value: Json): string {
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
const same = (a: Json, b: Json) => canonical(a) === canonical(b);
const idKey = (item: Identified) => `${typeof item.id}:${item.id}`;

export function mergeState(base: Json, local: Json, remote: Json, path = '$'): MergeResult {
  if (same(local, remote)) return { ok: true, value: local };
  if (same(base, local)) return { ok: true, value: remote };
  if (same(base, remote)) return { ok: true, value: local };

  if (isObject(local) && isObject(remote) && (base === undefined || isObject(base))) {
    const from = base ?? {};
    const merged: { [key: string]: StateJson } = {};
    const keys = [...new Set([...Object.keys(remote), ...Object.keys(local)])];
    for (const key of keys) {
      const result = mergeState(from[key], local[key], remote[key], `${path}.${key}`);
      if (!result.ok) return result;
      if (result.value !== undefined) merged[key] = result.value;
    }
    return { ok: true, value: merged };
  }

  if (identifiedArray(local) && identifiedArray(remote) && (base === undefined || identifiedArray(base))) {
    return mergeRecords(base ?? [], local, remote, path);
  }

  if (primitiveArray(local) && primitiveArray(remote) && (base === undefined || primitiveArray(base))) {
    // Unordered membership lists (tags, linked ids): apply both sides' additions and removals.
    const before = new Set((base ?? []).map(item => JSON.stringify(item)));
    const removedLocally = new Set([...before].filter(item => !local.some(value => JSON.stringify(value) === item)));
    const result = remote.filter(item => !removedLocally.has(JSON.stringify(item)));
    for (const item of local) {
      const encoded = JSON.stringify(item);
      if (!before.has(encoded) && !result.some(value => JSON.stringify(value) === encoded)) result.push(item);
    }
    return { ok: true, value: result };
  }

  return { ok: false, path };
}

function mergeRecords(base: Identified[], local: Identified[], remote: Identified[], path: string): MergeResult {
  const byId = (items: Identified[]) => new Map(items.map(item => [idKey(item), item]));
  const baseById = byId(base);
  const localById = byId(local);
  const remoteById = byId(remote);
  const merged = new Map<string, Identified>();
  for (const id of new Set([...remoteById.keys(), ...localById.keys(), ...baseById.keys()])) {
    const result = mergeState(baseById.get(id), localById.get(id), remoteById.get(id), `${path}[id=${id.slice(id.indexOf(':') + 1)}]`);
    if (!result.ok) return result;
    if (result.value !== undefined) merged.set(id, result.value as Identified);
  }
  // Remote order is authoritative; local additions keep their position after
  // the nearest preceding record that survived the merge.
  const order = remote.map(idKey).filter(id => merged.has(id));
  local.forEach((item, index) => {
    const id = idKey(item);
    if (order.includes(id) || !merged.has(id)) return;
    let anchor = -1;
    for (let previous = index - 1; previous >= 0 && anchor < 0; previous--) anchor = order.indexOf(idKey(local[previous]));
    order.splice(anchor + 1, 0, id);
  });
  return { ok: true, value: order.map(id => merged.get(id)!) };
}
