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
- **Early returns over nested `if`/`else`.** Handle edge cases and errors first, then the main path.
- **Make illegal states unrepresentable.** Discriminated unions and branded IDs over loose strings and optional flags.
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
- **Shared test helpers** live in `packages/engine/test/utils/` (standard investigators, card and definition builders, `startScenario`, `run`, `codesIn`, `rejectionOf`); import them from `../test/utils` in the engine and `@arkham/engine/test/utils` elsewhere. Add a helper there once a second test file needs it.
- **One behaviour per test**, named as a sentence about behaviour: `it('rejects moving a card into its own zone')`.
- **Exception: end-to-end scenario tests** (`packages/scenarios/src/*/end_to_end.test.ts`) may be one long narrative test that plays the scenario in order, with short phase/turn comment headers (`// Round 2 – investigation: Roland's turn`) and assertions in place.
- **Scenario flow tests reuse the shared `TestTable` helpers** (`packages/scenarios/src/<scenario>/test_table.ts`): every test that plays a scenario through phases and turns sets up and drives the game with the same table instead of its own command lists, so all flow tests read alike. Unit tests of single rules stay fine-grained in the engine.
- **Arrange – act – assert**, separated by blank lines; no logic (loops, conditionals) in assertions.
- **Test through the public API** of the module (commands in, events/state out for the engine), not internals.
- **Invariants are covered by example-based table tests** (`it.each` over a few named, readable cases), not property-based testing. Unit tests for concrete rules and edge cases.
- Never use real card text, ArkhamDB JSON or images in fixtures; the hand-written test scenario uses real codes and names with hand-entered stats only (see `CLAUDE.md`).

**E2E flow specs** (`apps/web/e2e/`, tagged `@flow`) are recorded as screencasts for every PR that changes the UI (`docs/automation.md`). Keep them few and stable:

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
