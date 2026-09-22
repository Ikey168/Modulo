import type { LifeRecord } from '../lifeStore';
import { canonicalUrl } from './model';
/** Keep the user's durable record and triage state while refreshing source metadata. */
export function mergeFeedItems(current: LifeRecord[], incoming: LifeRecord[]): LifeRecord[] {
  const result = [...current];
  for (const item of incoming) {
    const url = canonicalUrl(item.values.url || '');
    const index = result.findIndex(old => (url && canonicalUrl(old.values.url || '') === url)
      || (!!item.values.externalId && old.values.externalId === item.values.externalId
        && (old.values.feedUrl || old.values.source) === (item.values.feedUrl || item.values.source)));
    if (index < 0) result.unshift(item);
    else {
      const old = result[index];
      result[index] = { ...old, values: { ...old.values, ...item.values }, title: item.title || old.title };
    }
  }
  return result;
}
