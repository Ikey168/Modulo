import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const temporary = mkdtempSync(resolve(tmpdir(), 'modulo-mobile-inventory-'));
const generatedCatalog = resolve(temporary, 'catalog.json');
const generatedStorage = resolve(temporary, 'storage.json');
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));

try {
  execFileSync(resolve(root, 'node_modules/.bin/vite-node'),
    ['scripts/inventoryPluginCatalog.ts', generatedCatalog], { cwd: resolve(root, 'frontend'), stdio: 'inherit' });
  execFileSync(process.execPath, [resolve(root, 'frontend/scripts/inventoryPluginStorage.mjs'), generatedStorage],
    { cwd: root, stdio: 'inherit' });
  const expectedCatalog = read(resolve(root, 'docs/mobile/plugin-catalog-inventory.json'));
  const actualCatalog = read(generatedCatalog);
  if (JSON.stringify(actualCatalog) !== JSON.stringify(expectedCatalog)) {
    throw new Error('Plugin catalog changed. Regenerate docs/mobile/plugin-catalog-inventory.json and review Android coverage.');
  }
  const expectedStorage = read(resolve(root, 'docs/mobile/plugin-storage-inventory.json'));
  const actualStorage = read(generatedStorage);
  const countByFile = (accesses) => {
    const counts = new Map();
    for (const access of accesses) {
      const key = `${access.file}:${access.api}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  };
  const baseline = countByFile(expectedStorage.storageAccesses);
  for (const [key, count] of countByFile(actualStorage.storageAccesses)) {
    if (count > (baseline.get(key) ?? 0)) {
      throw new Error(`New browser Storage access in ${key}. Plugin state belongs in the durable state API.`);
    }
  }
  if (actualStorage.catalogCount !== expectedStorage.catalogCount) {
    throw new Error('Storage inventory plugin count changed. Regenerate the inventory after reviewing ownership.');
  }
  process.stdout.write(`Catalog verified: ${actualCatalog.count} plugins; browser Storage references ${actualStorage.storageAccesses.length}/${expectedStorage.storageAccesses.length} baseline.\n`);
} finally { rmSync(temporary, { recursive: true, force: true }); }
