# Review guide

For the `pr-reviewer` subagent, which Claude sessions run on their branch before opening a PR, and for the on-demand CI review (`claude-review` label). The owner reviews on a phone and spends that time on rules, readable tests and API design. This guide makes sure the mechanical points are caught before the owner looks. The rules themselves live in `CLAUDE.md` and `docs/coding-guidelines.md`; this file only says what to check and how hard.

## Blocking: always flag

- **Game rules.** Behaviour that contradicts `docs/rules.md` or the Rules Reference, or a rule choice the players make at the table that the code picks silently instead of raising a `Decision`. Quote the rule.
- **Ground rules.** Engine purity (no React, DOM, IndexedDB, fetch, `Date.now()`, `Math.random()`); state changes outside Command → Events → reducer; storage outside `GameStore`; ArkhamDB card JSON, card text or images in the repo.
- **Test readability** (coding guidelines §3):
  - a test that can't be understood from its body plus the `describe` right above it;
  - generated or positional IDs (`d0`, `L1`), cryptic codes, or far-away fixtures whose contents matter;
  - property-based tests;
  - assertions on formatted text where structured data exists.
- **Test coverage.** New engine or scenario behaviour without a unit test, and a new rule without a step in the end-to-end scenario test.
- **Helpers in the wrong place.**
  - A test helper a second test file needs that is not in `packages/engine/test/utils/` or `PlayTable` / `BoardView` (`packages/engine/src`).
  - A lookup or query re-implemented inline when it exists, or should exist, next to its entity (`board.ts`, `lookup.ts`).
  - A generic string, array or object operation inlined instead of living in `@arkham/util`.
- **Architecture doc out of date.** A change that adds or alters a component (a new kind of command, trigger, decision, setup step, store method, package or dependency direction) without updating that component's section in `docs/architecture.md`.
- **Silent `catch`**, `any` without a comment, an exported type or function without a doc comment.
- **PR shape** (coding guidelines §7): more than one reviewable idea, or over the size budget without a stack plan (slice sub-issues) on the task issue; a review thread from an earlier round left unanswered.

## Nits: flag as optional

- Naming: an abbreviation, a vague name, or one that hides what the value is about (`acc`, `isInPlay` on locations).
- More than one non-obvious positional argument where an options object reads better; `ctx` not the first argument.
- `if` chains where a `switch` over a union reads better.
- A new dispatch over a closed union (discriminant or literal union) that is not an exhaustive `switch` with an `assertNever` default (coding guidelines §1).
- A comment that narrates what the code does instead of why.
- Dashes in file names, German identifiers, presentational markup, raw CSS values.
- A PR description that explains in prose what a snippet or a link would show, or misses a snippet of its key API change (coding guidelines §7 "Writing the description").

## Don't comment on

- Formatting and import order (Prettier and ESLint own them).
- Lockfile, changelog, release manifest, and `docs/tasks/done/` archive edits.
- Bundle size and Lighthouse numbers (their own jobs report them).
- Test details that don't affect readability, such as the exact choice of example values.

## Summary format

Start with one line per **rules claim** in the PR description, each marked as verified, wrong or unverified. Then list the blocking findings, then the count of nits. Keep it short enough to read on a phone.
