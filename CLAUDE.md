# CLAUDE.md – Arkham Companion

Web companion app (PWA) that runs the scenario side of Arkham Horror LCG (full campaigns, starting with _Night of the Zealot_; campaign order in `docs/product.md`).
`docs/architecture.md` describes the app as built: an overview linking one page per component in `docs/architecture/` (how it works and why, its key types, its extension points). Read the component's page before changing it, don't re-derive it, and update that page in the same PR when the change extends or alters it; the overview changes only for a new package, dependency direction, key design decision or component page. Requirements, screens, the milestone plan and designs for what isn't built yet are in `docs/product.md`.
Work is tracked in GitHub issues: one parent issue per milestone, tasks and slices as sub-issues (`docs/tasks/README.md`). Each task issue is self-contained; `docs/tasks/done/` is the archive of finished work.
Game rules are summarised in `docs/rules.md` with links to the Rules Reference – check there before searching the web, and update it when a change corrects a rule.
Code style and conventions (functions, comments, tests, markup, CSS, helpers) are in `docs/coding-guidelines.md` – follow them in every change.

## Ground rules

- **Engine is pure.** `packages/engine` has no React, DOM, IndexedDB, fetch or `Date.now()`/`Math.random()`. Randomness only via the seeded RNG in state.
- **Every state change is Command → Events → reducer.** Never mutate state outside the reducer.
- **Storage only via `GameStore`.** The app never talks to Dexie/IndexedDB directly.
- **Never commit ArkhamDB card JSON or card images.** Fetched data goes to `packages/carddata/.cache/` (gitignored). Tests use invented cards or the hand-written test scenario (`packages/scenarios/src/the_gathering/`): real card codes and names are fine there, but stats are entered by hand and there is no card text, JSON or image. The only exception: E2E downloads the pictures those cards name into the gitignored `apps/web/e2e/.card_pictures/` before it runs (`e2e/fixtures/card_pictures.ts`, cached in CI), so shots show real art; they are never committed.
- **Generic before specific:** if two scenarios need it, make it an engine primitive.
- **Markup is structure only.** JSX/HTML is a plain document tree of semantic elements (no `<strong>`, `<b>`, `<br>`, inline `style`, layout/styling class names); all presentation lives in CSS.
- **Underscores, never dashes, in source file and directory names** under `packages/` and `apps/` (`handle_board.ts`, `the_gathering/`). Tool-mandated names keep theirs (`pnpm-workspace.yaml`, `release-please-config.json`, `.claude/` agent and hook files, `docs/*.md`).
- **No German words in code** (identifiers); German only in UI translation strings.
- TypeScript strict, no `any` without a comment explaining why. **Prefer strong types:** branded types for identifiers and card codes, literal unions for closed sets, no bare `string`/`number` for domain values (`docs/coding-guidelines.md` §1).
- Every exported interface, type, class and non-trivial function gets a doc comment explaining its purpose and, where it isn't obvious, how it relates to other types (e.g. which reducer produces it, which ID it refers to). Also explain non-obvious design choices (why, not what).
- **In-code comments explain why, not what.** Inside function bodies, comment only to give a motivation the code can't express (game rule, workaround, trade-off) – never to narrate steps.
- **Never swallow a caught error silently.** A `catch` at least `console.warn`s with context (and may still fall back), or rethrows. The engine has no console: it turns errors into rejections instead.
- **Styles use tokens.** Colours, spacing, sizes come from `apps/web/src/styles/tokens.css`; no raw values or copy-pasted declarations elsewhere.
- **Reuse helpers.** Generic string/array/object operations live in `@arkham/util` (`packages/util`); add missing ones there with tests instead of inlining them. **Shared functions live next to the entity they handle** (card lookups with the cards, location queries with the board); only generic string, array and object helpers go to `@arkham/util`.
- Tests with every change: Vitest unit tests for engine logic; cover invariants with example-based table tests (`it.each`), no property-based testing.
- **Tests are readable and local.** A reader must understand each test from its body plus the `describe` setup right above it, without scrolling or decoding. Every card, ID, zone and value an assertion checks is written there with a readable name (`plain_treachery`, `instanceId('top_card')`). No generated or positional IDs (`d0`, `L1`), no cryptic codes, no shared fixtures whose contents matter but sit far away, no hidden defaults that affect the result. Helpers may build state, but their call site must name what they build.

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

Each milestone issue (label `milestone`, listed in `docs/tasks/README.md`) lists its tasks as sub-issues in order; do them in that order. A task issue's first line names the model: **Sonnet** is enough, **Opus** for design-heavy work. A task is one session, delivered as one or more small PRs. Start one from the phone: Code tab → repo → `Do task M1C.6 (#278)`.

1. Read the task issue (with its parent and sub-issues) and only the architecture sections it references.
2. Keep the change small and focused on that task: one reviewable idea per PR, within the size budget in `docs/coding-guidelines.md` §7 – split bigger tasks into a stack of PRs and open one sub-issue per slice first (title `M1C.4c …`, a short body, the `**Model:** … · **Area:** …` line). Open a sub-issue (GitHub MCP `issue_write` with `parent_issue_number`) for each follow-up instead of doing it: under the task it came from, or under the milestone for a new task (`M5.6 …`, with Why, Benefit and a checklist). New milestones are new parent issues with the `milestone` label, added to `docs/tasks/README.md` and `docs/product.md`.
3. The PR body says `Closes #<slice or task issue>`. Tick the task issue's checklist and, when the work changes the plan, edit its body; a short "Done" comment on the task issue records what was built. Close a task once its slices are closed; its follow-ups stay open as sub-issues.
4. Open a PR against `main`. **The PR title is a Conventional Commit** – it becomes the squash commit and the changelog entry (Release Please):
   `feat(engine): add hunter movement (M1.8)`, `fix(web): …`, `docs: …`, `test: …`, `refactor: …`, `chore: …`, `ci: …`. Scope = package (`engine`, `carddata`, `scenarios`, `web`, `util`) when it fits.
   **The PR description is short and points at the code** (`docs/coding-guidelines.md` §7 "Writing the description"): why the PR exists in 1–3 sentences, the key API/code changes as short snippets, then the template's **Review map**, with links to the changed code and docs instead of prose. Plain words. Never attribute a choice to a person ("Andy asked/chose/wanted …"); give the reason. The required attribution block at the top of the body stays. Use `.github/pull_request_template.md`. Before opening, run the `pr-reviewer` subagent on the branch and fix its blocking findings; then post its summary as a PR comment and its remaining findings as inline comments, and resolve each of those threads once it is fixed or answered (the `main` ruleset blocks merging while a review thread is open). Run it again before asking for review after a round of changes.
   **Open the PR as the bot, not yourself:** push the branch, then dispatch `open-pr.yml` on `main` (GitHub MCP `actions_run_trigger`, `run_workflow`, inputs `branch`, `title`, `body`, optional `base` for a stacked PR and `draft`). It opens the PR as the repo's GitHub App, assigned to the owner with the owner's review requested, so the owner can approve it. Find the new PR by its head branch (`list_pull_requests`), then subscribe to it as usual. Only if the run fails (see its log) open the PR directly; the owner then merges it with the admin bypass. When the owner's review has comments, address each one, reply on its thread and resolve it, then request the owner's review again (`update_pull_request` with `reviewers`): that puts the PR back on the owner's review list (`docs/automation.md`, "Review queue").
5. Keep the PR mergeable: when the PR gets the `needs-rebase` label (set by `pr-sync.yml`) or shows conflicts, merge `main` into the branch (a merge commit, never rebase a pushed branch), resolve conflicts, rerun typecheck, lint and tests, and push. Don't merge `main` into a clean PR just because `main` moved: every push re-runs all checks. Ask only when a conflict needs a real decision.
6. CI must be green: typecheck, lint, coverage floors, E2E, CodeQL. Check the PR preview link and the bundle-size comment for UI changes.
   **UI changes tag `@flow` on every E2E flow and `@shot` on every screenshot spec that shows them, and only those** (a screenshot for a change one picture shows, a flow for one you have to see happen): the specs they add or extend, and any existing one whose recorded behavior or picture they change even when its code stays the same. They remove the tags from all others (rules in `docs/coding-guidelines.md` §3); the preview workflow records the tagged specs and puts their screencasts and screenshots into the PR description, so it shows only what the PR changed.

## Subagents

- `rules-checker` – after implementing or changing game rules, ask it to check the change against the official rules. Post its rules claims table as a PR comment, and when it confirms a correction, update `docs/rules.md` in the same PR.
- `pr-reviewer` – reviews the branch against `REVIEW.md` in a fresh context; replaces a paid CI reviewer because it runs in the session.
- `test-writer` – to add missing unit/property tests, e.g. when coverage drops below the floor.

More on the automation: `docs/automation.md`.

## Language

Code, comments, docs and commit messages in English.
