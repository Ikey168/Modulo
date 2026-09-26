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
    // Android P08 (#486): plugin records, settings, drafts, recovery data and
    // queues use durable plugin state or device storage (IndexedDB/SQLite),
    // never browser Storage. Only the isolated legacy migration module and
    // authentication protocol state may reference it.
    'no-restricted-globals': [
      'error',
      { name: 'localStorage', message: 'Use durable plugin state or services/deviceDocuments; legacy reads belong in services/legacy (#486).' },
      { name: 'sessionStorage', message: 'Keep session-only state in memory; legacy reads belong in services/legacy (#486).' },
    ],
    'no-restricted-properties': [
      'error',
      { object: 'window', property: 'localStorage', message: 'Use durable plugin state or services/deviceDocuments (#486).' },
      { object: 'window', property: 'sessionStorage', message: 'Keep session-only state in memory (#486).' },
      { object: 'globalThis', property: 'localStorage', message: 'Use durable plugin state or services/deviceDocuments (#486).' },
      { object: 'globalThis', property: 'sessionStorage', message: 'Keep session-only state in memory (#486).' },
      { object: 'window', property: 'moduloDesktop', message: 'Use desktopServices()/capabilities from @/platform (#489).' },
    ],
    // B9 boundary guard — feature-pack code must import via @modulo/core, not workspace internals.
    // Flipped to 'error' in B9 (#302) after B4–B7 cleared all violations.
    // See docs/architecture/B2-boundary-audit.md for violation history.
    // Rationale (why a typed core behind a public API, not a generic graph):
    // docs/architecture/adr-0002-core-keeps-first-class-types.md (B8 #301).
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
    // The platform module is the only reader of the Electron bridge (#489).
    {
      files: ['src/platform/**', 'src/services/desktop.ts', 'src/types/desktop.d.ts'],
      rules: { 'no-restricted-properties': 'off' },
    },
    // The isolated legacy migration reader, authentication protocol state and
    // tests are the only permitted browser Storage users (#482, #486, #488).
    {
      files: [
        'src/services/legacy/**',
        'src/features/auth/**',
        'src/components/mobile/OAuthCallback.tsx',
        'src/setupTests.ts',
        'tests/**',
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
      rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
    },
    // src/core/ is the implementation of @modulo/core — it legitimately imports workspaceApi.
    {
      files: ['src/core/**/*.ts', 'src/core/**/*.tsx'],
      rules: { 'no-restricted-imports': 'off' },
    },
  ],
};
