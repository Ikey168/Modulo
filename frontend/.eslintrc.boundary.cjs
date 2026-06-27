// Minimal ESLint config used exclusively by the CI boundary gate (B9 #302).
// Checks only the no-restricted-imports boundary rule — intentionally ignores
// all other rules so pre-existing non-boundary lint issues don't mask boundary
// regressions or produce false failures.
//
// Run via: npm run lint:boundary:ci
// Rationale: docs/architecture/B2-boundary-audit.md

module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  parser: '@typescript-eslint/parser',
  // react-hooks plugin declared so eslint-disable-next-line comments that
  // reference react-hooks/* rules don't produce "rule not found" errors.
  plugins: ['react-hooks'],
  ignorePatterns: [
    'dist',
    'node_modules',
    // Core implementation is allowed to import workspace internals by design.
    'src/core/**',
    // Pre-existing JSX parse error unrelated to the boundary rule.
    'src/features/notes/Notes.tsx',
  ],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
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
        ],
      },
    ],
  },
};
