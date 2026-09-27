// Minimal ESLint config used exclusively by the CI boundary gate (B9 #302).
// Checks only the no-restricted-imports boundary rules — intentionally ignores
// all other rules so pre-existing non-boundary lint issues don't mask boundary
// regressions or produce false failures.
//
// Two boundaries are enforced:
//   1. Core boundary: feature code imports @modulo/core, not workspace internals.
//   2. Pack boundary (#548): code in src/packs/<a>/ never imports src/packs/<b>/.
//      Packs share code through @modulo/core, @/ui, the workspace view kit,
//      plugin types and the shared modules in features/workspace and services.
//
// .eslintrc.cjs reuses `rules` and `overrides` from this file, so the full lint
// and this gate always enforce the same boundaries.
//
// Run via: npm run lint:boundary:ci
// Rationale: docs/architecture/decisions.md#core-experience-boundary
// Non-goal guard (the core stays concretely typed, not a generic graph):
// docs/architecture/decisions.md#adr-0002 (B8 #301).

const { readdirSync } = require('node:fs');
const { join } = require('node:path');

const CORE_BOUNDARY_PATTERNS = [
  {
    group: ['**/features/workspace/workspaceApi', '../features/workspace/workspaceApi'],
    message:
      'Import from @modulo/core instead of workspaceApi directly. See B1 #294 / B9 #302.',
  },
  {
    group: ['**/features/workspace/types', '../features/workspace/types'],
    message:
      'Use CoreNote/CoreLink/CoreTag from @modulo/core instead of workspace types. See B1 #294 / B9 #302.',
  },
  {
    group: [
      '**/features/workspace/useWorkspaceData',
      '../features/workspace/useWorkspaceData',
    ],
    message:
      'Use createCoreAPI() from @modulo/core instead of useWorkspaceData. See B1 #294 / B9 #302.',
  },
];

// Every directory under src/packs is a pack. Read at lint time so a new pack is
// covered without editing this file.
const PACKS_DIR = join(__dirname, 'src/packs');
const PACKS = readdirSync(PACKS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

// no-restricted-imports only sees the import string, so a pack is matched in
// every spelling that can reach it from inside another pack: through the
// src/packs path (`@/packs/b`, `../../packs/b`) and as a sibling directory
// (`../b` from a pack root, `../../b` from `plugins/` or `__tests__/`, …).
// A pattern also covers everything below the directory it names.
const packPatterns = (pack) => [
  `**/packs/${pack}`,
  `../${pack}`,
  `../../${pack}`,
  `../../../${pack}`,
  `../../../../${pack}`,
];

const PACK_OVERRIDES = PACKS.map((pack) => ({
  files: [`src/packs/${pack}/**/*.ts`, `src/packs/${pack}/**/*.tsx`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          ...CORE_BOUNDARY_PATTERNS,
          {
            group: PACKS.filter((other) => other !== pack).flatMap(packPatterns),
            message:
              `Pack "${pack}" must not import another pack. Move shared code to features/workspace ` +
              '(or @modulo/core, @/ui, services) and import it from there. See #548 and ' +
              'docs/architecture/frontend.md#pack-boundary.',
          },
        ],
      },
    ],
  },
}));

module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  parser: '@typescript-eslint/parser',
  // Load plugins referenced by inline directives without enabling their rules.
  // The boundary-only gate must still understand those rule names.
  plugins: ['react-hooks', 'react-refresh'],
  ignorePatterns: [
    'dist',
    'node_modules',
    // Core implementation is allowed to import workspace internals by design.
    'src/core/**',
    // Pre-existing JSX parse error unrelated to the boundary rule.
    'src/features/notes/Notes.tsx',
  ],
  rules: {
    'no-restricted-imports': ['error', { patterns: CORE_BOUNDARY_PATTERNS }],
  },
  overrides: PACK_OVERRIDES,
};
