// ESLint config for the Modulo frontend.
// Boundary rule (no-restricted-imports) guards the @modulo/core API surface:
// feature-pack code must not bypass the core API by importing workspace internals
// directly. The rule is 'warn' now; it becomes 'error' in B9 (#302).
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    // B2 boundary guard — import core types/data via @modulo/core, not internal paths.
    // Will be 'error' in B9 once B4-B7 land and fix the violations.
    'no-restricted-imports': [
      'warn',
      {
        patterns: [
          {
            group: ['**/features/workspace/workspaceApi', '../features/workspace/workspaceApi'],
            message:
              "Use @modulo/core instead of workspaceApi directly (B1 #294). Will be 'error' in B9 (#302).",
          },
          {
            group: ['**/features/workspace/types', '../features/workspace/types'],
            message:
              "Use CoreNote/CoreLink/CoreTag from @modulo/core instead of workspace types (B1 #294). Will be 'error' in B9 (#302).",
          },
          {
            group: [
              '**/features/workspace/useWorkspaceData',
              '../features/workspace/useWorkspaceData',
            ],
            message:
              "Use createCoreAPI() from @modulo/core instead of useWorkspaceData (B1 #294). Will be 'error' in B9 (#302).",
          },
        ],
      },
    ],
  },
  overrides: [
    // src/core/ is the implementation of @modulo/core — it legitimately imports workspaceApi.
    {
      files: ['src/core/**/*.ts', 'src/core/**/*.tsx'],
      rules: { 'no-restricted-imports': 'off' },
    },
  ],
};
