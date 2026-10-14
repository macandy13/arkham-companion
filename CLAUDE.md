# CLAUDE.md – Arkham Companion

Web companion app (PWA) that runs the scenario side of Arkham Horror LCG (Chapter Two, starting with `core_2026`).
The full design is in `docs/architecture.md` – read the relevant section before changing architecture, don't re-derive it.
Work is tracked in `docs/tasks/`. Each task file is self-contained.
Code style and conventions (functions, comments, tests, markup, CSS, helpers) are in `docs/coding-guidelines.md` – follow them in every change.

## Ground rules

- **Engine is pure.** `packages/engine` has no React, DOM, IndexedDB, fetch or `Date.now()`/`Math.random()`. Randomness only via the seeded RNG in state.
- **Every state change is Command → Events → reducer.** Never mutate state outside the reducer.
- **Storage only via `GameStore`.** The app never talks to Dexie/IndexedDB directly.
- **Never commit ArkhamDB card JSON or card images.** Fetched data goes to `packages/carddata/.cache/` (gitignored). Tests use invented cards or the hand-written test scenario (`packages/scenarios/src/the-gathering/`): real card codes and names are fine there, but stats are entered by hand and there is no card text, JSON or image.
- **Generic before specific:** if two scenarios need it, make it an engine primitive.
- **Markup is structure only.** JSX/HTML is a plain document tree of semantic elements (no `<strong>`, `<b>`, `<br>`, inline `style`, layout/styling class names); all presentation lives in CSS.
- **No German words in code** (identifiers); German only in UI translation strings.
- TypeScript strict, no `any` without a comment explaining why.
- Every exported interface, type, class and non-trivial function gets a doc comment explaining its purpose and, where it isn't obvious, how it relates to other types (e.g. which reducer produces it, which ID it refers to). Also explain non-obvious design choices (why, not what).
- **In-code comments explain why, not what.** Inside function bodies, comment only to give a motivation the code can't express (game rule, workaround, trade-off) – never to narrate steps.
- **Styles use tokens.** Colours, spacing, sizes come from `apps/web/src/styles/tokens.css`; no raw values or copy-pasted declarations elsewhere.
- **Reuse helpers.** Generic string/array/object operations live in `@arkham/util` (`packages/util`); add missing ones there with tests instead of inlining them.
- Tests with every change: Vitest unit tests for engine logic; cover invariants with example-based table tests (`it.each`), no property-based testing. Keep tests local: the values an assertion depends on are visible in the test or its `describe` setup.

## Commands

- `pnpm install`
- `pnpm test` – all unit tests; `pnpm test:coverage` – with the coverage floors CI enforces (`vitest.config.ts`)
- `pnpm typecheck`
- `pnpm lint` (`pnpm format` fixes formatting)
- `pnpm e2e` – Playwright against the production build (`apps/web/e2e/`)
- `pnpm dev` – web app (apps/web); `pnpm build` – production build
- `pnpm carddata:fetch` – fetch and normalise ArkhamDB packs into the local cache

Before finishing a task: `pnpm typecheck && pnpm lint && pnpm test` must pass. A Stop hook (`.claude/hooks/verify-before-stop.ts`) runs these automatically when code changed and sends failures back to you – fix them, don't work around the hook.

## Workflow for tasks

1. Read the task file in `docs/tasks/` and only the architecture sections it references.
2. Keep the change small and focused on that task; note follow-ups in the task file instead of doing them.
3. Tick the task's checklist and add a short "Done" note when finished.
4. Open a PR against `main`. **The PR title is a Conventional Commit** – it becomes the squash commit and the changelog entry (Release Please):
   `feat(engine): add hunter movement (M1.8)`, `fix(web): …`, `docs: …`, `test: …`, `refactor: …`, `chore: …`, `ci: …`. Scope = package (`engine`, `carddata`, `scenarios`, `web`, `util`) when it fits.
   **The PR description starts with the motivation** – why the PR exists and what it is trying to accomplish – before any list of changes. Follow `.github/pull_request_template.md`.
5. CI must be green: typecheck, lint, coverage floors, E2E, CodeQL. Check the PR preview link and the bundle-size comment for UI changes.

## Subagents

- `rules-checker` – after implementing or changing game rules, ask it to check the change against the official rules.
- `test-writer` – to add missing unit/property tests, e.g. when coverage drops below the floor.

More on the automation: `docs/automation.md`.

## Language

Code, comments, docs and commit messages in English.
