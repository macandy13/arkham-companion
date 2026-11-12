# Decisions

Where the players must choose, or the engine needs an answer it cannot know (a skill test result, a spawn location, "advance the agenda?"), it puts a [`Decision`](../../packages/engine/src/state.ts) into `pending`.

- Each option carries the commands it triggers, so outcomes are data; counts the players may adjust are written as `{ answer: 'damage' }` placeholders.
- Basic action tests name the action (`testKind`) and compute their consequences on the answer, so corrections made meanwhile count.
- Options are answered by readable name (`optionNamed`), so options that pick a card are labelled with [`cardOptionLabels`](../../packages/engine/src/decisions.ts): the printed name, with the location added for copies of one card ("Ghoul Minion (Cellar)") and a number where that still leaves two alike.
- `ResolveDecision` runs the chosen option; for a skill test it records `SkillTestResolved` and, when the answer lists the tokens the app drew (`revealed`), a `ChaosBagChanged` removal for each bless and curse among them, which go back to their pool; while a decision is pending, only answers, `ManualAdjust` and `SpendResources` (paying for a fast player card played in the decision's window, Dodge or Lucky!) are allowed.
- Each decision names its `decider`: the lead investigator for a choice the rules leave to the group (Rules Reference, "Choices"), or the investigator a rule names, such as the one who drew an enemy for its spawn location ([`chooseLocation`](../../packages/engine/src/engagement.ts)'s `decider`).
- A decision about a card goes when that card leaves (defeated, evaded, an advanced agenda or act), and an enemy phase attack question (`enemyPhaseAttackDecision`) goes when the investigator it asks leaves the game, as their enemies leave them. An open new-lead question is withdrawn (`DecisionWithdrawn`) and asked again among those left when another investigator leaves before it is answered ([`elimination.ts`](../../packages/engine/src/elimination.ts)).

Card data asks with `leadDecides` ("the lead investigator must decide") or `youMustEither` (the investigator the window names), an `AbilityChoice` whose options run ability effects.

- A part that touches player cards ("draw 2 cards") is only in the option's label, for the players to do at the table.
- Before an ability asks, a dry run of each option's commands drops the ones the engine would reject (spending a clue nobody has) or that would emit no event (healing nobody's damage); an option with no commands is done at the table and stays.
- A choice with no option left is not asked; a choice nested in a test's outcome is asked as it is.

Skill tests ([`skill_tests.ts`](../../packages/engine/src/skill_tests.ts)) carry a suggestion from:

- the printed skill,
- its lasting boost (`Investigator.skillBoosts`: what player cards in play add, such as an ally's +1 combat, which the players set with a `ManualAdjust` of kind `skillBoost` and which lasts until they change it),
- the cards in play that change the skill ("You get -1 [willpower]", `skillChanges`), a step each,
- one player-entered modifier
- and the chaos tokens.

Its difficulty is the card's value with its modifiers (`effectiveValue`). A test against a card value keeps how it was made (`SkillTest.modifiedFrom`: the printed value and each card's `CardChange`, from `modifiedValue`), so the trace has a `{ kind: 'card', cardId }` step per card in play that changes it ("Obscuring Fog +2").

The tokens are drawn as the players draw them by [`drawTokens`](../../packages/engine/src/draw_tokens.ts): one, then another while the last is a bless, curse, frost or blood token, until a second frost, which ends the reveals and fails the test (`revealsMore`, `skillTestSuggestion`). It takes its random numbers from the caller, since a draw is not game state: the app's "Draw a token" passes `Math.random`, the play tester its seeded random.

Player cards change a draw after it is out (ME.24), so the dialog keeps it as a [`TestDraw`](../../packages/engine/src/draw_tokens.ts), still outside game state: each drawn token is resolved, cancelled or ignored, and may be treated as another token. Pure functions change it as the cards say (`revealAnother`, `withTokenState`, `treatTokenAs`, `redrawToken`, which puts the token back and draws in its place, `replaceToken`, which swaps it for a token of a kind the players pick from the bag), and `continueDraw` draws on until `drawFinished`. Cancelling, ignoring or redrawing a token also puts back the tokens it made the tester reveal (`DrawnToken.chained`). The calculation gets only `resolvedTokens`; the answer sends the resolved ones as they came out (`revealedTokens`) as `revealed`, since a cancelled or ignored token counts as never revealed.

Before the draw, [`skillTestOdds`](../../packages/engine/src/skill_test_odds.ts) works out how likely the test is to pass from the bag: every way `drawTokens` could draw, each valued by `skillTestSuggestion`. A draw with a token the engine has no number for (the elder sign, a symbol whose effect replaces its number) counts as `unknown` rather than a guess. Draws that revealed the same tokens share their odds, so a bag full of bless and curse tokens stays quick.

Sealed tokens are out of `GameState.chaosBag` (`SealChaosToken`, `ReleaseChaosToken`, rules "Skill tests"), so no draw reveals them.

The answer stays the players' pass or fail.

## Extension points

- **Ask the players something:** return a `RequestDecision`; helpers for common shapes are in [`decisions.ts`](../../packages/engine/src/decisions.ts).
- **A new kind of question:** a `DecisionKind`, plus its debug sentence in [`describe_decision.ts`](../../packages/engine/src/describe_decision.ts). A new adjustable count is a name in `NAMED_AMOUNTS`.
- **A new skill-tested action:** a `SkillTestKind` and its resolver in `testedActionCommands`.
- **A board-dependent token value ("-X"):** a `tokenValues` entry in the scenario's `modifiers`.
