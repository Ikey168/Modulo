import { expect, test } from '@playwright/test';

test('offline note edits survive reload in IndexedDB and stay account-partitioned', async ({ page }) => {
  await page.goto('/');
  const partition = 'modulo.offline-notes.v1:smoke-alice';
  await page.evaluate(async key => {
    const { IndexedDbNoteCache } = await import('/src/services/offlineNoteCache.ts');
    await new IndexedDbNoteCache().save(key, { version: 1,
      notes: [{ id: 7, title: 'Offline draft', content: 'Kept after reload', version: 1 }],
      pending: { '7': { body: { title: 'Offline draft', content: 'Kept after reload', version: 1 }, baseVersion: 1 } },
      resources: {} });
  }, partition);
  await page.reload();
  const result = await page.evaluate(async key => {
    const { IndexedDbNoteCache } = await import('/src/services/offlineNoteCache.ts');
    const cache = new IndexedDbNoteCache();
    return { own: await cache.load(key), other: await cache.load('modulo.offline-notes.v1:smoke-bob') };
  }, partition);
  expect(result.own?.pending['7'].body.content).toBe('Kept after reload');
  expect(result.other).toBeNull();
});
