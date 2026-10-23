import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/** CLAUDE.md ground rule: the engine and the scenarios import no UI, storage, i18n or Node APIs. */
const pureImports = {
  group: ['react', 'react-*', 'dexie', 'i18next', 'zustand', '@arkham/web', 'node:*'],
  message: 'The engine is pure: no UI, storage, i18n or Node APIs (CLAUDE.md).',
};

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.cache/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // `no-empty` treats a comment-only block as non-empty, so it cannot enforce "never swallow".
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CatchClause > BlockStatement[body.length=0]',
          message: 'Do not swallow errors: console.warn them with context or rethrow.',
        },
      ],
    },
  },
  // CLAUDE.md ground rule: the engine and the scenarios are pure. Randomness comes from the
  // seeded RNG in state, time and I/O from the app, so a game replays identically.
  {
    files: ['packages/engine/src/**/*.ts', 'packages/scenarios/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [pureImports],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG in state.' },
        { object: 'Date', property: 'now', message: 'Time comes from the app, not the engine.' },
      ],
      'no-restricted-globals': [
        'error',
        ...['fetch', 'window', 'document', 'localStorage', 'indexedDB', 'console'].map((name) => ({
          name,
          message: 'The engine is pure and has no I/O; return a rejection or an event instead.',
        })),
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CatchClause > BlockStatement[body.length=0]',
          message: 'Do not swallow errors: console.warn them with context or rethrow.',
        },
        {
          selector: 'NewExpression[callee.name="Date"]',
          message: 'Time comes from the app, not the engine.',
        },
      ],
    },
  },
  // A command handler never imports another one: what two handlers share is a query or an
  // event builder, and it lives next to its entity (board.ts, enemies.ts, investigators.ts).
  // Repeats the purity pattern because this block replaces the purity block's options for handlers.
  {
    files: ['packages/engine/src/handle_*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            pureImports,
            {
              group: ['./handle_*'],
              message:
                'Handlers never import handlers: move the shared query or event builder next to its entity.',
            },
          ],
        },
      ],
    },
  },
  // CLAUDE.md ground rule: storage only via GameStore, whose IndexedDB implementation is the
  // one file allowed to touch Dexie.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/storage/IndexedDbStore.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'dexie', message: 'Use GameStore; only IndexedDbStore talks to Dexie.' }],
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
