# Tests and debugging

Engine modules have unit tests; invariants have table tests.
Each scenario has an end-to-end test ([`end_to_end.test.ts`](../../packages/scenarios/src/the_gathering/end_to_end.test.ts)) that plays rounds through a `PlayTable`, checking invariants after every command and replaying the log at the end.
[`formatBoard`](../../packages/engine/src/format_board.ts) renders the board as stable text for snapshots and errors.

The three test tools live in the engine's source, so the app uses them too:

- **`newGame()`** ([`game_builder.ts`](../../packages/engine/src/game_builder.ts)) builds a table from locations, maps, investigators and cards in zones, each placed with its [blank card](../../packages/engine/src/blank_cards.ts) definition carrying only the stats the test is about, and starts it through `StartScenario`. Unit tests build their tables with it instead of file-local setup helpers, and every card and ID an assertion checks is named in the test ([coding guidelines](../coding-guidelines.md) §3).
- **`PlayTable`** ([`play_table.ts`](../../packages/engine/src/play_table.ts)) plays a table in game language (`nextPhase()`, `moveTo(byName('Roland Banks'), byName('Hallway'))`, `answer(…, 'fail')`). Each method is one atomic undo group; a refusal throws `TableRejected` with the board attached.
- **`BoardView`** ([`board_view.ts`](../../packages/engine/src/board_view.ts)) reads the state back by card name, derived when read. Finders take matchers from [`card_matchers.ts`](../../packages/engine/src/card_matchers.ts) (`byName`, `byId`, `byCode`) and throw when nothing or several cards match, so a test never acts on the wrong copy.

## Extension points

- **A new table piece:** a `with*` method on `GameBuilder` that adds to the `StartScenario`; never set state directly.
- **A new player step or read-back:** a `PlayTable` method, or a field or view in `board_view.ts`.
- **A new way to find a card:** a `CardMatcher` variant with its cases in `matchingCards`, `matchingInvestigators` and `describeMatcher`.
- **A rule change:** a step in the end-to-end test where it shows at the table.
