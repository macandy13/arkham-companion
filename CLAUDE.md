# CLAUDE.md – Arkham Companion

Web companion app (PWA) that runs the scenario side of Arkham Horror LCG (Chapter Two, starting with `core_2026`).
The full design is in `docs/architecture.md` – read the relevant section before changing architecture, don't re-derive it.
Work is tracked in `docs/tasks/`. Each task file is self-contained.

## Ground rules

- **Engine is pure.** `packages/engine` has no React, DOM, IndexedDB, fetch or `Date.now()`/`Math.random()`. Randomness only via the seeded RNG in state.
- **Every state change is Command → Events → reducer.** Never mutate state outside the reducer.
- **Storage only via `GameStore`.** The app never talks to Dexie/IndexedDB directly.
- **Never commit ArkhamDB card JSON or card images.** Fetched data goes to `packages/carddata/.cache/` (gitignored).
- **Generic before specific:** if two scenarios need it, make it an engine primitive.
- TypeScript strict, no `any` without a comment explaining why.
- Every exported interface, type, class and non-trivial function gets a doc comment explaining its purpose and, where it isn't obvious, how it relates to other types (e.g. which reducer produces it, which ID it refers to). Also explain non-obvious design choices (why, not what).
- Tests with every change: Vitest unit tests for engine logic; add a fast-check property test when touching invariants.

## Commands

- `pnpm install`
- `pnpm test` – all unit tests
- `pnpm typecheck`
- `pnpm lint`
- `pnpm dev` – web app (apps/web)
- `pnpm carddata:fetch` – fetch and normalise ArkhamDB packs into the local cache

Before finishing a task: `pnpm typecheck && pnpm test` must pass.

## Workflow for tasks

1. Read the task file in `docs/tasks/` and only the architecture sections it references.
2. Keep the change small and focused on that task; note follow-ups in the task file instead of doing them.
3. Tick the task's checklist and add a short "Done" note when finished.
4. Commit with a clear message; open a PR against `main`.

## Language

Code, comments, docs and commit messages in English.
