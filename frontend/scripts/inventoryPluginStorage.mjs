import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const sourceRoots = [resolve(root, 'src/features/workspace'), resolve(root, 'src/services')];
const files = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.[jt]sx?$/.test(entry.name)) files.push(path);
  }
}
sourceRoots.forEach(walk);
const relativeFile = (path) => relative(resolve(root, '..'), path);
const issueFor = (file) => {
  if (/legacyStateImport/.test(file)) return 'P04';
  if (/pluginState(Client|Transport)|workspaceStateHost/.test(file)) return 'P03';
  if (/plugins\/(runtime|modes|installationState)|workspace(Storage|Recovery)|noteDrafts|savedSearchesStore|searchIndex/.test(file)) return 'P08';
  if (/\/(para|routines|timeTracking|todos|workoutPlanner|mealPlanner)\.ts$/.test(file)) return 'P05';
  if (/\/(lifeOs|lifeStore|hobbies|musicStudio|wardrobe|mediaLibrary|ttrpg)\.ts$/.test(file)) return 'P06';
  return 'P07';
};
const storageAccesses = [];
const storeKeys = [];
const sharedWrites = [];
for (const file of files.sort()) {
  const source = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const display = relativeFile(file);
  const ownership = issueFor(display);
  const seen = new Set();
  const visit = (node) => {
    if (ts.isIdentifier(node) && ['localStorage', 'sessionStorage'].includes(node.text)) {
      const location = ast.getLineAndCharacterOfPosition(node.getStart(ast));
      const key = `${node.text}:${location.line + 1}`;
      if (!seen.has(key)) { storageAccesses.push({ file: display, line: location.line + 1, api: node.text, issue: ownership }); seen.add(key); }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /(STORE_KEY|STORAGE_KEY|_KEY)$/.test(node.name.text)) {
      const location = ast.getLineAndCharacterOfPosition(node.getStart(ast));
      const initializer = node.initializer;
      if (initializer && (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer))) {
        storeKeys.push({ file: display, line: location.line + 1, name: node.name.text, value: initializer.text, issue: ownership });
      }
    }
    if (ts.isIdentifier(node) && ['writeWorkspaceJson', 'useWorkspaceStore'].includes(node.text) && ts.isCallExpression(node.parent) && node.parent.expression === node) {
      const location = ast.getLineAndCharacterOfPosition(node.getStart(ast));
      sharedWrites.push({ file: display, line: location.line + 1, helper: node.text, issue: ownership });
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
}
const catalog = JSON.parse(readFileSync(resolve(root, '../docs/mobile/plugin-catalog-inventory.json'), 'utf8'));
const complex = /(^|[-])(graph|canvas|database|blueprint)([-]|$)/;
const remote = /(^|[-])(pdf|archive|caldav|feed|webwatch|notification|file-search|provider|mcp)([-]|$)/;
const pluginCoverage = catalog.entries.map((plugin) => ({ ...plugin,
  androidIssue: complex.test(plugin.id) ? 'P14' : remote.test(plugin.id) ? 'P17' : 'P13',
  storageIssue: /^(productivity|para)$/.test(plugin.category) ? 'P05'
    : /^(life|hobbies|media|music|health|home|relationships)$/.test(plugin.category) ? 'P06' : 'P07',
}));
const result = { catalogCount: pluginCoverage.length, runnableCount: pluginCoverage.filter((item) => item.runnable).length,
  pluginCoverage, storageAccesses, storeKeys, sharedWrites,
  note: 'Static discovery baseline. Runtime-computed keys, aliases and capabilities require P01 manual review before closure.' };
writeFileSync(process.argv[2] ? resolve(process.argv[2]) : resolve(root, '../docs/mobile/plugin-storage-inventory.json'),
  JSON.stringify(result, null, 2) + '\n');
process.stdout.write(JSON.stringify({ catalog: result.catalogCount, directStorageReferences: storageAccesses.length, literalKeys: storeKeys.length, sharedWrites: sharedWrites.length }) + '\n');
