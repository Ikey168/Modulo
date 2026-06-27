// ESLint config for the Modulo frontend.
// Boundary rule (no-restricted-imports) guards the @modulo/core API surface:
// feature-pack code must not bypass the core API by importing workspace internals
// directly. Rule is 'error' as of B9 (#302) — violations block CI.
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', '.eslintrc.boundary.cjs', 'node_modules'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    // B9 boundary guard — feature-pack code must import via @modulo/core, not workspace internals.
    // Flipped to 'error' in B9 (#302) after B4–B7 cleared all violations.
    // See docs/architecture/B2-boundary-audit.md for violation history.
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
  overrides: [
    // src/core/ is the implementation of @modulo/core — it legitimately imports workspaceApi.
    {
      files: ['src/core/**/*.ts', 'src/core/**/*.tsx'],
      rules: { 'no-restricted-imports': 'off' },
    },
  ],
};
