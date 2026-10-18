# Coding guidelines

How code in this repo should look, so every task lands in the same style.
`CLAUDE.md` holds the hard ground rules (pure engine, Command → Events → reducer, …); this file holds the conventions. When in doubt, match the surrounding code.

## 1. Code

- **Readable and concise.** Write for the next reader. Prefer the obvious solution over the clever one, but don't pad.
- **Small functions.** A function does one thing at one level of abstraction. If it needs section comments, scrolling, or more than a few levels of nesting, split it into named helpers. Roughly: past ~30 lines, look for a split.
- **Descriptive names.** Names say what a value _is_ (`encounterDeck`, `defeatedInvestigators`), functions say what they _do_ (`drawEncounterCard`). Single letters only for tiny lambdas and indices (`cards.map((c) => c.code)`). No abbreviations beyond common ones (`id`, `rng`, `i`).
- **File names use underscores, never dashes.** Source files and directories under `packages/` and `apps/` are `snake_case` (`handle_board.ts`, `the_gathering/`), so a name reads like an identifier and imports stay consistent. Names a tool dictates are exempt (`pnpm-workspace.yaml`, `release-please-config.json`, `.claude/` agent and hook files, `docs/*.md`).
- **Pure functions by default.** Compute and return new values instead of mutating arguments or touching globals. Push side effects (storage, network, DOM, time) to the edges and keep them thin, so the logic in between is trivially testable.
- **Immutable data.** Use `readonly` in types and spread/`map`/`filter` over in-place mutation.
- **One exception to both: a builder confined to one call.** A pure function may create a mutable builder, such as `handle`'s `Resolution`, and pass it to the helpers it calls, as long as it never escapes that call. From outside the function stays pure, and inside, the helpers append to one value instead of threading states and lists through every call.
- **Early returns over nested `if`/`else`.** Handle edge cases and errors first, then the main path.
- **Strong types wherever possible.** A domain value gets its own type, never a bare `string` or `number`: branded types (`Brand` in `ids.ts`) for every kind of identifier, card codes included, so an investigator's card code can't be passed where an `InvestigatorId` is expected; literal unions over `string` for closed sets (`'physical' | 'mental'`); discriminated unions over optional flags, so illegal states are unrepresentable. Plain `string`/`number` is for free text and real quantities only.
- **Options objects for unclear arguments.** A function with more than one non-obvious parameter (several numbers, booleans or strings in a row) takes an options object, so call sites read `location({ code, shroud: 2, cluesPerInvestigator: 1 })` instead of `location(code, 2, 1)`.
- **Never swallow a caught error silently.** A `catch` either rethrows or logs a `console.warn` with context; a fallback is fine, a silent one is not. The error is always bound (`catch (error)`) so it can be passed on. The engine has no console and turns errors into rejections instead. ESLint rejects empty `catch` blocks (a comment alone does not count).

  ```ts
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Could not save settings; they apply for this session only.', error);
  }
  ```

- **No dead code, no speculative abstractions.** Delete unused code; generalise once the second caller appears (see "Generic before specific").

## 2. Comments

**Doc comments** are required: every exported interface, type, class and non-trivial (top-level) function gets one explaining its purpose and, where it isn't obvious, how it relates to other types (which reducer produces it, which ID it refers to). See `CLAUDE.md`.

**In-code comments** (inside function bodies) explain **why**, never **what**. The code itself (names, types, small functions) should already say what happens.

- Write one when the motivation is not obvious from the code: a rule from the game, a workaround, a deliberate trade-off, a non-obvious invariant, why the simpler-looking alternative is wrong. These comments matter – keep them accurate when the code changes.
- Don't write comments that restate the code, narrate steps, or label sections. If you feel the need, rename or extract a function instead.
- No commented-out code and no `TODO`s without a task reference – follow-ups go into the task file.

## 3. Tests

- **Keep it local and readable.** A reader must understand each test from its body plus the `describe` setup right above it, without scrolling or decoding. Every card, ID, zone and value an assertion checks is written there with a readable name. No generated or positional IDs (`d0`, `L1`), no cryptic codes (`'SUR'`), no shared fixtures whose contents matter but sit far away, no hidden defaults that affect the result. Helpers may build state, but their call site names what they build:

  ```ts
  // Bad: what is `d0`, what does `SUR` do, where is it?
  const state = started({ deck: ['SUR', 'DUL'] });
  expect(order(after, deck)).toEqual(['d0']);

  // Good: the cards, IDs and zones are in the test.
  const state = startedWith(
    {
      deck: [card('surge_treachery', 'surge_card'), card('plain_treachery', 'after_surge')],
    },
    { aliceAt: hall },
  );
  expect(idsIn(after, encounterDeck)).toEqual(['after_surge']);
  ```

- **Sane defaults via builders.** Use small factory helpers with defaults and overrides (`makeInvestigator({ id: 'a', clues: 2 })`) so tests only spell out what is relevant to them. Defaults should be boring; anything a test depends on is passed explicitly.
- **Build the table with `newGame()`** and blank cards (`blankLocation({ code: 'study', shroud: 2 })`) instead of a file-local `startedWith` helper: a describe-level builder holds the common table, and each test adds the cards it is about (`table.withCard(ghoul, ghoulCard, engagedWith(alice)).start()`).
- **Shared test helpers** live in `packages/engine/test/utils/` (standard investigators, card and definition builders, `startScenario`, `run`, `codesIn`, `rejectionOf`); import them from `../test/utils` in the engine and `@arkham/engine/test/utils` elsewhere. Add a helper there once a second test file needs it.
- **One behaviour per test**, named as a sentence about behaviour: `it('rejects moving a card into its own zone')`.
- **Exception: end-to-end scenario tests** (`packages/scenarios/src/*/end_to_end.test.ts`) may be one long narrative test that plays the scenario in order, with short phase/turn comment headers (`// Round 2 – investigation: Roland's turn`) and assertions in place.
- **A new or changed rule shows up at the table.** Every PR that adds or changes a game rule extends an end-to-end scenario test with a step where the rule happens in play, and links that step in the PR's review map. Rule gaps are easiest to spot in a playthrough, not in unit tests of the rule alone.
- **Scenario flow tests reuse the shared `TestTable` helpers** (`packages/scenarios/src/<scenario>/test_table.ts`): every test that plays a scenario through phases and turns sets up and drives the game with the same table instead of its own command lists, so all flow tests read alike. Unit tests of single rules stay fine-grained in the engine.
- **Arrange – act – assert**, separated by blank lines; no logic (loops, conditionals) in assertions.
- **Test through the public API** of the module (commands in, events/state out for the engine), not internals.
- **Invariants are covered by example-based table tests** (`it.each` over a few named, readable cases), not property-based testing. Unit tests for concrete rules and edge cases.
- Never use real card text, ArkhamDB JSON or images in fixtures; the hand-written test scenario uses real codes and names with hand-entered stats only (see `CLAUDE.md`).

**E2E flow specs** (`apps/web/e2e/`, tagged `@flow`) are recorded as screencasts for every PR that changes the UI (`docs/automation.md`). Keep them few and stable:

- **A UI PR shows its change in a screencast.** Every PR that changes the UI adds or extends a `@flow` spec that walks through the change, so reviewers see it in the PR description. Once the change is reviewed and its recording is no longer of interest, a follow-up PR drops the `@flow` tag (the spec stays as a plain E2E test if it still guards something, otherwise it goes). That way a PR carries only the screencasts that matter for it, not every flow in the app.
- **One spec per user journey, not per feature.** A UI change extends the flow it belongs to before it adds a new one. Cap: 8 flow specs; past that, merge flows.
- **They check wiring, not rules.** Game rules are tested in engine unit tests; a flow only asserts that the screen reacts and the journey completes.
- **Locate by role and accessible name** (`getByRole('button', { name: … })`), never by CSS class or DOM shape – the markup rules make this always possible.
- **Narrate with steps.** Group the flow into `test.step('Create an empty game', …)` blocks named as what the user does; the names are shown as captions in the screencast.
- **Deterministic.** Start from a fixed state (seeded game) so every recording of the same code looks the same.

## 4. Markup (JSX/HTML)

The DOM is a clearly structured document tree – good structure _is_ accessibility.

- Use semantic elements for what content is: `header`, `main`, `nav`, `aside`, `section`, `article`, `footer`, `ul`/`ol`, `dl`, `table`, `figure`, `form`, `fieldset`/`legend`, `label`.
- **Headings form an outline:** one `h1` per screen, no skipped levels, every landmark/section that has a title gets a heading.
- **Interactive elements are native:** `button` for actions, `a` for navigation, form controls with a `label`. Never a clickable `div`.
- Give landmarks and controls an accessible name (`aria-label`/`aria-labelledby`) when visible text doesn't provide one. Use ARIA only where native semantics are insufficient.
- No presentational markup: no wrapper `div`s just for styling when an existing element can be styled, no `<b>`/`<strong>`/`<br>`, no inline `style`, no layout or utility class names (see `CLAUDE.md`).
- Every visible string goes through i18n.
- **Show results where the user acted.** Details, sheets and confirmations open next to the element that opened them (e.g. an expanded row inside the list, right after the tapped item), never at the end of a long list, so a tap never needs a scroll to see what it did.

## 5. CSS

- **Tokens first.** Raw values (colours, spacing, font sizes, radii, borders, layout sizes) live only in `apps/web/src/styles/tokens.css` as custom properties. Everything else uses `var(--…)`. A new raw value means a new token, named by its role (`--color-danger`, not `--red`).
- **Spacing scale.** Margin, padding and gap use `--space-1` … `--space-5` only. If none fits, discuss extending the scale instead of using a one-off value.
- **Shared terminology.** Name things once and reuse the name: a "panel", a "card", a "stepper" means the same component everywhere and is styled in one place. If two rules look alike, extract a shared selector or token instead of copying declarations.
- **Minimal styles.** Only write what changes the browser default or the inherited value. Prefer layout primitives (`grid`, `flex` + `gap`) over margins on children.
- **Selectors follow structure.** Style by element and landmark/role within a component scope (`#shell > header`, `[aria-current]`, `button:disabled`) rather than inventing presentational classes. Keep specificity low and nesting shallow.
- **Structure files by concern:** `tokens.css` (values), `base.css` (element defaults) when it grows, then one stylesheet per component/screen next to its component.
- State lives in attributes the markup already needs (`disabled`, `aria-expanded`, `aria-current`), not in extra classes.

## 6. Helper library

Common, generic operations go into small, tested helpers instead of being re-implemented inline.

- **`@arkham/util`** (`packages/util`) holds pure, dependency-free helpers usable from every package, grouped by topic (`string.ts`, later e.g. `array.ts`, `record.ts`). Example: `stripSuffix(name, '.json')` instead of `name.endsWith('.json') ? name.slice(0, -5) : name`.
- Before writing a one-off string/array/object manipulation, check `@arkham/util` and the standard library. If it's not there and it's generic, add it there (with tests) rather than inline.
- Domain helpers stay in their package (e.g. card helpers in `packages/carddata/src/helpers.ts`, zone helpers in the engine).
- **Shared functions live next to the entity they handle.** A lookup or query that several modules need is built once, in the module of the thing it finds, and the others import it: card lookups with the cards (`cardsNamed`, `cardsOfType` in the engine's `lookup.ts`), location queries with the board (`locationsNamed`, `locationsInPlay` in `board.ts`). Before writing another `Object.values(state.cards).filter(…)`, check whether such a function exists; if not, add it there with tests. Only generic string, array and object helpers go to `@arkham/util`.
- Helpers are pure, small, total (defined for every input, including empty strings/arrays) and named after what they return.

## 7. Pull requests

A PR is reviewed on a phone, in one sitting. Its size and shape decide whether the review catches the rules and design questions or drowns in plumbing.

- **One reviewable idea per PR:** one rule, one API change (commands, events, state shape), one screen or one refactor. A task that needs several of these becomes several PRs.
- **Size budget.** Aim for at most ~400 changed lines of production code and ~1000 changed lines in total (tests included; lockfile, generated files and `docs/tasks/` excluded). Past that, split, unless the extra lines are one mechanical change (a rename, a moved file) that reads at a glance.
- **Plan the slices before coding.** When a task will exceed the budget, list its PRs in the task file first (`M1.13a – modifier types and events`, `M1.13b – …`), so each session knows its slice and the reviewer knows what comes next.
- **Split in reading order:**
  1. preparatory `refactor:` PRs that change no behaviour: helper moves, test-util changes, renames. The description says "no behaviour change", so they can be approved by skimming;
  2. types and API: new commands, events and state, with the reducer cases and invariants;
  3. the rule or logic itself, with its unit tests and its step in the end-to-end scenario test;
  4. wiring and UI.
- **Stacked PRs** each target the previous PR's branch, are green on their own, and carry their position in the title (`feat(engine): add skill modifiers (M1.13, 2/3)`). Merge them in order.
- **Review fixes stay in the reviewed PR.** Answer every review thread in the PR it was raised on; never merge with open threads, and don't push the fix into a later PR of the stack. If a point is out of scope, the reply names the task it was moved to.
- **Commits in reading order** inside a PR: types and API first, then logic, then tests, then wiring, so "review by commit" tells the story.
