import { ESLint } from 'eslint';
import { readFile, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';

const eslint = new ESLint({ reportUnusedDisableDirectives: 'error' });
const results = await eslint.lintFiles(['**/*.ts', '**/*.tsx']);
const current = {};
for (const result of results) {
  for (const message of result.messages) {
    const key = JSON.stringify([relative(process.cwd(), result.filePath), message.ruleId, message.severity, message.message]);
    current[key] = (current[key] ?? 0) + 1;
  }
}
const baselinePath = new URL('../eslint-baseline.json', import.meta.url);
if (process.argv.includes('--write-baseline')) {
  await writeFile(baselinePath, JSON.stringify(current, Object.keys(current).sort(), 2) + '\n');
} else {
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
  const newFindings = Object.entries(current).filter(([key, count]) => count > (baseline[key] ?? 0));
  if (newFindings.length) {
    console.error('New lint findings (existing findings are tracked in eslint-baseline.json):');
    for (const [key, count] of newFindings) console.error(key, `(${count - (baseline[key] ?? 0)} new)`);
    process.exitCode = 1;
  } else {
    console.log(`No new lint findings. ${Object.values(current).reduce((a, b) => a + b, 0)} existing findings remain.`);
  }
}
