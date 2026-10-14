# Coding guidelines

How code in this repo should look, so every task lands in the same style.
`CLAUDE.md` holds the hard ground rules (pure engine, Command → Events → reducer, …); this file holds the conventions. When in doubt, match the surrounding code.

## 1. Code

- **Readable and concise.** Write for the next reader. Prefer the obvious solution over the clever one, but don't pad.
- **Small functions.** A function does one thing at one level of abstraction. If it needs section comments, scrolling, or more than a few levels of nesting, split it into named helpers. Roughly: past ~30 lines, look for a split.
- **Descriptive names.** Names say what a value _is_ (`encounterDeck`, `defeatedInvestigators`), functions say what they _do_ (`drawEncounterCard`). Single letters only for tiny lambdas and indices (`cards.map((c) => c.code)`). No abbreviations beyond common ones (`id`, `rng`, `i`).
- **Pure functions by default.** Compute and return new values instead of mutating arguments or touching globals. Push side effects (storage, network, DOM, time) to the edges and keep them thin, so the logic in between is trivially testable.
- **Immutable data.** Use `readonly` in types and spread/`map`/`filter` over in-place mutation.
- **Early returns over nested `if`/`else`.** Handle edge cases and errors first, then the main path.
- **Make illegal states unrepresentable.** Discriminated unions and branded IDs over loose strings and optional flags.
- **No dead code, no speculative abstractions.** Delete unused code; generalise once the second caller appears (see "Generic before specific").

## 2. Comments

**Doc comments** are required: every exported interface, type, class and non-trivial (top-level) function gets one explaining its purpose and, where it isn't obvious, how it relates to other types (which reducer produces it, which ID it refers to). See `CLAUDE.md`.

**In-code comments** (inside function bodies) explain **why**, never **what**. The code itself (names, types, small functions) should already say what happens.

- Write one when the motivation is not obvious from the code: a rule from the game, a workaround, a deliberate trade-off, a non-obvious invariant, why the simpler-looking alternative is wrong. These comments matter – keep them accurate when the code changes.
- Don't write comments that restate the code, narrate steps, or label sections. If you feel the need, rename or extract a function instead.
- No commented-out code and no `TODO`s without a task reference – follow-ups go into the task file.

## 3. Tests

- **Keep it local.** A reader should understand a test without scrolling. The values that matter for an assertion are visible in the test itself, or at least in the `beforeEach`/setup of the same `describe` block – never in a distant shared fixture.
- **Sane defaults via builders.** Use small factory helpers with defaults and overrides (`makeInvestigator({ clues: 2 })`) so tests only spell out what is relevant to them. Defaults should be boring; anything a test depends on is passed explicitly.
- **One behaviour per test**, named as a sentence about behaviour: `it('rejects moving a card into its own zone')`.
- **Arrange – act – assert**, separated by blank lines; no logic (loops, conditionals) in assertions.
- **Test through the public API** of the module (commands in, events/state out for the engine), not internals.
- **Property tests** (fast-check) for invariants; unit tests for concrete rules and edge cases.
- Never use real card text in fixtures (see `CLAUDE.md`).

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
- **Enforced by Stylelint** (`stylelint.config.js`, part of `pnpm lint`): outside `tokens.css`, colours, spacing, font, border and shadow properties must use `var(--…)` or a keyword (`0`, `auto`, `none`, …); hex colours, colour functions and `!important` are rejected; nesting and selector depth are capped. Don't silence a rule with a disable comment – add a token instead.

## 6. Helper library

Common, generic operations go into small, tested helpers instead of being re-implemented inline.

- **`@arkham/util`** (`packages/util`) holds pure, dependency-free helpers usable from every package, grouped by topic (`array.ts`, `record.ts`, `string.ts`, …). Example: `splitTrimmed(traits, '.')` instead of `traits.split('.').map((t) => t.trim()).filter(Boolean)`.
- Before writing a one-off string/array/object manipulation, check `@arkham/util` and the standard library. If it's not there and it's generic, add it there (with tests) rather than inline.
- Domain helpers stay in their package (e.g. card helpers in `packages/carddata/src/helpers.ts`, zone helpers in the engine).
- Helpers are pure, small, total (defined for every input, including empty strings/arrays) and named after what they return.
