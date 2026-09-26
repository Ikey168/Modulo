/**
 * Android P01 (#479) inventory: every catalog plugin with its contributions,
 * storage ownership, schemas, device/native and backend dependencies, and the
 * issues responsible for its storage migration and Android parity.
 *
 *   ../node_modules/.bin/vite-node scripts/inventoryAndroid.ts            # write docs
 *   ../node_modules/.bin/vite-node scripts/inventoryAndroid.ts --check    # CI: fail on drift
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import type { PluginContext, PluginModule } from '../src/features/workspace/plugins/types';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://inventory.invalid/' });
for (const name of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'HTMLElement',
  'Element', 'Node', 'Event', 'CustomEvent', 'MutationObserver'] as const) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
const { CATALOG } = await import('../src/features/workspace/plugins/catalog');
const { LEGACY_KEY_REGISTRY, ownerOfLegacyKey } = await import('../src/services/legacy/legacyKeyRegistry');

const frontend = resolve(import.meta.dirname, '..');
const repository = resolve(frontend, '..');
const source = resolve(frontend, 'src');
const display = (path: string) => relative(repository, path);

// ── Static dependency scan ───────────────────────────────────────────────────
const SHARED = /\/(plugins\/(types|runtime|catalog|PluginProvider|useDurableRecord|usePluginState)|services\/|ui\/|components\/ui\/|viewkit\/|core\/|hooks\/|lib\/)/;
const MARKERS: Array<[string, RegExp]> = [
  ['desktop-native-services', /nativeDesktop\(/],
  ['notifications', /\bnew Notification\(|Notification\.requestPermission|showNotification\(/],
  ['file-picker', /type=["']file["']|showOpenFilePicker|showSaveFilePicker/],
  ['file-download', /\.download\s*=|download=\{/],
  ['camera-or-media', /navigator\.mediaDevices|capture=["']/],
  ['clipboard', /navigator\.clipboard/],
  ['geolocation', /navigator\.geolocation/],
  ['external-links', /window\.open\(/],
  ['wallet', /window\.ethereum|ethers\./],
];
const importsOf = (file: string): string[] => {
  const text = readFileSync(file, 'utf8');
  const found = new Set<string>();
  for (const match of text.matchAll(/(?:import|export)[^'"]*?from\s+['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
    const specifier = match[1] ?? match[2];
    for (const candidate of ['.tsx', '.ts', '/index.tsx', '/index.ts', '']) {
      const path = resolve(dirname(file), specifier + candidate);
      if (existsSync(path) && !path.endsWith('/') && /\.(tsx?)$/.test(path)) { found.add(path); break; }
    }
  }
  return [...found];
};
function closure(entry: string, depth = 2): string[] {
  const seen = new Set<string>([entry]);
  let frontier = [entry];
  for (let level = 0; level < depth; level++) {
    const next: string[] = [];
    for (const file of frontier) for (const dependency of importsOf(file)) {
      if (seen.has(dependency) || SHARED.test(dependency) || dependency.includes('__tests__')) continue;
      seen.add(dependency); next.push(dependency);
    }
    frontier = next;
  }
  return [...seen].sort();
}
function scan(files: string[]) {
  const native = new Set<string>();
  const backend = new Set<string>();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const [name, pattern] of MARKERS) if (pattern.test(text)) native.add(name);
    for (const match of text.matchAll(/['"`](\/api\/[a-z0-9-]+(?:\/[a-z0-9-]+)?)/g)) backend.add(match[1]);
  }
  return { native: [...native].sort(), backend: [...backend].sort() };
}

// ── Catalog activation ───────────────────────────────────────────────────────
type Contributions = { views: string[]; notePanels: string[]; noteFences: string[]; editorActions: string[]; blueprintNodes: string[] };
const COMPLEX = /(^|-)(graph|canvas|database|blueprint|mermaid|latex|kanban|timeline|diagram|whiteboard|pdf)(-|$)/;
const PHONE_NATIVE = new Set(['desktop-native-services']);

function androidIssue(id: string, contributions: Contributions, native: string[]): 'P13' | 'P14' | 'P15' | 'P16' | 'P17' {
  if (native.some(item => PHONE_NATIVE.has(item))) return 'P17';
  if (COMPLEX.test(id) || contributions.noteFences.length > 0 && contributions.views.length === 0) return 'P14';
  if (native.includes('notifications')) return 'P16';
  if (native.includes('file-picker') || native.includes('camera-or-media')) return 'P15';
  return 'P13';
}
function storageIssueFor(category: string): 'P05' | 'P06' | 'P07' {
  if (/^(productivity|para)$/.test(category)) return 'P05';
  if (/^(life|hobbies|media|music|health|home|relationships|style|ttrpg)$/.test(category)) return 'P06';
  return 'P07';
}

const plugins = [];
for (const plugin of CATALOG) {
  const contributions: Contributions = { views: [], notePanels: [], noteFences: [], editorActions: [], blueprintNodes: [] };
  let inventoryError: string | undefined;
  if (plugin.load) {
    try {
      const loaded = await plugin.load();
      const module: PluginModule = 'default' in loaded ? loaded.default : loaded;
      const ctx: PluginContext = {
        state: async () => { throw new Error('State is unavailable during inventory'); },
        addView: item => { contributions.views.push(item.id); },
        addNotePanel: item => { contributions.notePanels.push(item.id); },
        addNoteFence: item => { contributions.noteFences.push(item.language); },
        addEditorAction: item => { contributions.editorActions.push(item.id); },
        addBlueprintNode: item => { contributions.blueprintNodes.push(item.type); },
      };
      await module.activate(ctx);
    } catch (error) { inventoryError = String(error); }
  }
  // vite-node rewrites the catalog's lazy import() into __vite_ssr_dynamic_import__("/src/…").
  const modulePath = plugin.load ? /["'](\/src\/[^"']+)["']/.exec(plugin.load.toString())?.[1] : undefined;
  const entry = modulePath ? resolve(frontend, modulePath.slice(1)) : undefined;
  const files = entry && existsSync(entry) ? closure(entry) : [];
  const dependencies = scan(files);
  const storage = LEGACY_KEY_REGISTRY.filter(item => item.owner === plugin.id)
    .map(item => ({ key: item.key, disposition: item.disposition, issue: item.issue, destination: item.destination }));
  const schemas = [...new Set(storage.map(item => item.destination?.schemaId).filter(Boolean))].sort();
  plugins.push({
    id: plugin.id, name: plugin.name, category: plugin.category,
    builtin: plugin.builtin === true, runnable: typeof plugin.load === 'function',
    dependencies: plugin.dependencies ?? [],
    contributions,
    module: entry && existsSync(entry) ? display(entry) : null,
    storage, schemas,
    capabilities: [...(plugin.capabilities ?? [])],
    nativeDependencies: dependencies.native,
    backendEndpoints: dependencies.backend,
    issues: {
      storage: storage[0]?.issue ?? (typeof plugin.load === 'function' ? storageIssueFor(plugin.category) : null),
      android: typeof plugin.load === 'function' ? androidIssue(plugin.id, contributions, dependencies.native) : null,
    },
    ...(inventoryError ? { inventoryError } : {}),
  });
}
plugins.sort((a, b) => a.id.localeCompare(b.id));

// ── Browser Storage references ───────────────────────────────────────────────
const ALLOWED = [/^frontend\/src\/services\/legacy\//, /^frontend\/src\/features\/auth\//, /^frontend\/src\/components\/mobile\/OAuthCallback\.tsx$/];
const storageReferences: Array<{ file: string; line: number; api: string; allowed: boolean }> = [];
const walk = (directory: string) => {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, item.name);
    if (item.isDirectory()) { if (item.name !== '__tests__') walk(path); continue; }
    if (!/\.(tsx?)$/.test(item.name) || /\.test\.tsx?$/.test(item.name) || item.name === 'setupTests.ts') continue;
    readFileSync(path, 'utf8').split('\n').forEach((line, index) => {
      const code = line.replace(/\/\/.*$/, '');
      for (const api of ['localStorage', 'sessionStorage']) {
        if (new RegExp(`\\b${api}\\b`).test(code)) {
          const file = display(path);
          storageReferences.push({ file, line: index + 1, api, allowed: ALLOWED.some(pattern => pattern.test(file)) });
        }
      }
    });
  }
};
walk(source);

// Literal browser keys declared in source must each have one registered owner.
const declaredKeys: Array<{ file: string; key: string; owned: boolean }> = [];
const walkKeys = (directory: string) => {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, item.name);
    if (item.isDirectory()) { if (item.name !== '__tests__') walkKeys(path); continue; }
    if (!/\.(tsx?)$/.test(item.name) || /\.test\.tsx?$/.test(item.name)) continue;
    const text = readFileSync(path, 'utf8');
    for (const match of text.matchAll(/const [A-Za-z_]*(?:STORE_KEY|STORAGE_KEY|LEGACY_KEY|_KEY)\s*=\s*['`](modulo[-.:][^'`$]+)['`]/g)) {
      declaredKeys.push({ file: display(path), key: match[1], owned: Boolean(ownerOfLegacyKey(match[1])) });
    }
  }
};
walkKeys(source);

const runnable = plugins.filter(plugin => plugin.runnable);
const inventory = {
  generatedBy: 'frontend/scripts/inventoryAndroid.ts',
  note: 'Native and backend dependencies come from a static scan of each plugin module and two levels of its local imports.',
  totals: {
    catalog: plugins.length,
    runnable: runnable.length,
    contributions: Object.fromEntries((['views', 'notePanels', 'noteFences', 'editorActions', 'blueprintNodes'] as const)
      .map(kind => [kind, plugins.reduce((total, plugin) => total + plugin.contributions[kind].length, 0)])),
    androidIssues: Object.fromEntries(['P13', 'P14', 'P15', 'P16', 'P17'].map(issue => [issue, runnable.filter(plugin => plugin.issues.android === issue).length])),
    registeredKeys: LEGACY_KEY_REGISTRY.length,
    disallowedStorageReferences: storageReferences.filter(item => !item.allowed).length,
    unownedDeclaredKeys: declaredKeys.filter(item => !item.owned).length,
  },
  plugins,
  storageKeys: LEGACY_KEY_REGISTRY,
  storageReferences,
  declaredKeys,
};

// ── Parity matrix ────────────────────────────────────────────────────────────
const cell = (value: boolean | string) => value === true ? 'yes' : value === false ? '—' : value;
/** Android permission or platform route each device need maps to. */
const ANDROID_ROUTE: Record<string, string> = {
  'desktop-native-services': 'server/remote service (P17)',
  notifications: 'POST_NOTIFICATIONS',
  'file-picker': 'Storage Access Framework',
  'file-download': 'share sheet / SAF create',
  'camera-or-media': 'CAMERA',
  clipboard: 'clipboard',
  geolocation: 'ACCESS_FINE_LOCATION',
  'external-links': 'Custom Tabs',
  wallet: 'external wallet app',
};
const device = (needs: string[]) => needs.map(need => `${need} (${ANDROID_ROUTE[need] ?? need})`).join(', ');
const matrix = [
  '# Android phone and tablet parity matrix',
  '',
  'Generated by `frontend/scripts/inventoryAndroid.ts` from the runnable catalog and the',
  'legacy key registry. Each row is the behaviour a plugin must reach on a phone',
  '(single column, bottom navigation, sheets) and a tablet (two-pane where the',
  'desktop view has a list/detail split). It defines the acceptance target; device',
  'evidence is recorded by the Android acceptance issues, not by this table.',
  '',
  'Columns: **Records** — create/read/edit/delete through durable state or the Notes API;',
  '**Actions** — domain actions (editor actions, fences, workflow nodes); **Device** —',
  'capabilities the workflow needs and the Android permission or platform route that',
  'provides them; **Sync** — where the',
  'authoritative copy lives; **Offline** — edits queue offline (`queue`) or need the',
  'server (`online`).',
  '',
  '| Plugin | Surfaces | Records | Actions | Device | Sync | Offline | Storage issue | Android issue |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...runnable.map(plugin => {
    const surfaces = [
      plugin.contributions.views.length && `${plugin.contributions.views.length} view${plugin.contributions.views.length === 1 ? '' : 's'}`,
      plugin.contributions.notePanels.length && `${plugin.contributions.notePanels.length} note panel${plugin.contributions.notePanels.length === 1 ? '' : 's'}`,
      plugin.contributions.noteFences.length && `${plugin.contributions.noteFences.length} fence${plugin.contributions.noteFences.length === 1 ? '' : 's'}`,
    ].filter(Boolean).join(', ') || 'none';
    const actions = [
      plugin.contributions.editorActions.length && `${plugin.contributions.editorActions.length} editor`,
      plugin.contributions.blueprintNodes.length && `${plugin.contributions.blueprintNodes.length} workflow`,
      plugin.contributions.noteFences.length && 'render',
    ].filter(Boolean).join(', ') || '—';
    const records = plugin.storage.length ? 'CRUD' : plugin.contributions.views.length || plugin.contributions.notePanels.length ? 'CRUD (notes/state)' : 'read';
    const sync = plugin.storage.some(item => item.destination) ? [...new Set(plugin.storage.map(item => item.destination?.namespace).filter(Boolean))].join(', ')
      : plugin.backendEndpoints.length ? plugin.backendEndpoints.slice(0, 3).join(', ') : 'server state';
    const offline = plugin.backendEndpoints.some(endpoint => /noesis|vies|ai|ipfs|webhook|paperless|gmail|feeds|webwatch|mcp/.test(endpoint))
      || plugin.nativeDependencies.includes('desktop-native-services') ? 'online' : 'queue';
    return `| \`${plugin.id}\` | ${surfaces} | ${records} | ${actions} | ${cell(device(plugin.nativeDependencies) || false)} | ${sync} | ${offline} | ${plugin.issues.storage} | ${plugin.issues.android} |`;
  }),
  '',
].join('\n');

const inventoryPath = resolve(repository, 'docs/mobile/android-inventory.json');
const matrixPath = resolve(repository, 'docs/mobile/android-parity-matrix.md');
const serialized = JSON.stringify(inventory, null, 2) + '\n';
if (process.argv.includes('--check')) {
  const problems: string[] = [];
  if (plugins.some(plugin => plugin.inventoryError)) problems.push('A plugin failed to activate during inventory.');
  if (inventory.totals.disallowedStorageReferences) problems.push(`Browser Storage used outside services/legacy and auth: ${storageReferences.filter(item => !item.allowed).map(item => `${item.file}:${item.line}`).join(', ')}`);
  // Every device feature a plugin module uses must be covered by a capability one of its plugins declares.
  const COVERS: Record<string, string[]> = {
    'file-picker': ['files.pick', 'device.folders', 'documents.ocr', 'pdf.tools', 'backup.archive'],
    'file-download': ['files.save', 'backup.archive'],
    'camera-or-media': ['camera.capture'],
    notifications: ['notifications.local', 'reminders.scheduled'],
    'external-links': ['links.external'],
    'desktop-native-services': ['remote.fetch', 'remote.metadata', 'device.folders', 'documents.ocr', 'pdf.tools', 'backup.archive', 'reminders.scheduled', 'credentials.secure'],
    geolocation: ['location'],
    wallet: ['links.external'],
  };
  const byModule = new Map<string, typeof plugins>();
  for (const plugin of plugins) if (plugin.module) byModule.set(plugin.module, [...(byModule.get(plugin.module) ?? []), plugin]);
  for (const [module, members] of byModule) {
    const declared = new Set(members.flatMap(plugin => plugin.capabilities));
    for (const need of members[0].nativeDependencies) {
      if (COVERS[need] && !COVERS[need].some(capability => declared.has(capability))) {
        problems.push(`${module} uses ${need} but none of its plugins declares a capability for it (pluginCapabilities.ts).`);
      }
    }
    for (const plugin of members) {
      if (plugin.nativeDependencies.some(need => COVERS[need]) && plugin.capabilities.length === 0) {
        problems.push(`${plugin.id} uses device features but declares no capabilities (pluginCapabilities.ts).`);
      }
    }
  }
  if (inventory.totals.unownedDeclaredKeys) problems.push(`Storage keys without a registered owner: ${declaredKeys.filter(item => !item.owned).map(item => item.key).join(', ')}`);
  if (!existsSync(inventoryPath) || readFileSync(inventoryPath, 'utf8') !== serialized) problems.push('docs/mobile/android-inventory.json is stale. Regenerate it with scripts/inventoryAndroid.ts.');
  if (!existsSync(matrixPath) || readFileSync(matrixPath, 'utf8') !== matrix) problems.push('docs/mobile/android-parity-matrix.md is stale. Regenerate it with scripts/inventoryAndroid.ts.');
  // Adding a plugin view requires phone parity evidence for it (#497): regenerate with `npm run phone:parity`.
  const evidencePath = resolve(repository, 'docs/mobile/android-parity-evidence.json');
  if (!existsSync(evidencePath)) problems.push('docs/mobile/android-parity-evidence.json is missing. Run npm run phone:parity.');
  else {
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8')) as { results: Array<{ view: string; rendered: boolean; interactive: boolean }> };
    const checked = new Map(evidence.results.map(result => [result.view, result]));
    const views = plugins.filter(plugin => plugin.runnable).flatMap(plugin => plugin.contributions.views);
    const missing = views.filter(view => !checked.has(view));
    const failing = views.filter(view => checked.has(view) && !(checked.get(view)!.rendered && checked.get(view)!.interactive));
    if (missing.length) problems.push(`Views without phone parity evidence: ${missing.join(', ')}. Run npm run phone:parity.`);
    if (failing.length) problems.push(`Views failing phone parity: ${failing.join(', ')}.`);
  }
  if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
  else console.log(`Android inventory verified: ${inventory.totals.runnable} runnable plugins, ${inventory.totals.registeredKeys} registered keys, no disallowed Storage use.`);
} else {
  writeFileSync(inventoryPath, serialized);
  writeFileSync(matrixPath, matrix);
  console.log(JSON.stringify(inventory.totals));
}
