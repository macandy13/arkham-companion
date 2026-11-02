# Play screen: decisions

The first open decision shows as a [dialog](../../apps/web/src/screens/DecisionDialog.tsx) over the board, on the card dialog shell ([play screen](play-screen.md), `CardDialog`):

- beside the page, the card the decision is about, else the encounter card whose revelation asks it (`DecisionView.card`, a `CardFaceView`),
- who decides, in the kicker with their portrait, over the translated question with the card it is about,
- when a revelation asks the players something, whom the card being resolved was drawn for and its keywords as badges ([`ResolvingCard`](../../apps/web/src/encounter/ResolvingCard.tsx), `BoardView.resolving`: the card in the `resolving` zone with the investigator its queued placement names and its keywords, a gained surge included),
- the test of a skill test,
- and a choice row per option (MD.2c), its key (✓ for a pass, ✗ for a fail, else its number) before its readable name (`GameActions.answer` maps it to the option). A row without counts answers on tap; a row with counts is picked (`aria-pressed`) and waits for Done, the form's primary, so the players can change its numbers first. Done starts on the draw's outcome when that has counts, else on the first row with counts when no test decides (an attack of opportunity takes the attack).

A skill test one investigator takes also brings the test block the skill test dialog shares ([`TestCalculation.tsx`](../../apps/web/src/investigators/TestCalculation.tsx), MD.2b): `useSkillTest` keeps the run (skills, modifier, tokens drawn, `BoardView.skillTest`'s result) and `SkillTestBlock` shows it:

- the four skills as toggles with the investigator card's glyphs, starting on the test's skill; tapping another adds it (`SkillTestInput.addedSkill`), tapping the first then drops it, so the players can switch (a card can test another skill);
- the modifier, for committed cards and card effects (a difficulty stepper only in the panel's own test);
- the result strip (`ResultStrip`), shown from the start: the skill value's terms and their sum left; in the middle the draw button until a token is out, then the tokens drawn, a symbol token with its effect under it, and their sum when there are several ("?" for one the app cannot tell); PASS or FAIL over the total against the difficulty and the margin right, once a token is out.
The calculation marks the answer it works out and sends that one with its `margin`, while the other still overrides it (the screen keys the dialog by the decision's id, so a draw never carries over).

- An option's counts (`DecisionView.counts`: the clues a passed investigation discovers, the damage a passed fight deals, an attack's damage and horror) show as steppers within their limits on the row of their answer, marked "from the game" (on a phone each label stands over its stepper), which carries them as `amount` and `amounts`.
- An option whose answer asks the same players to choose right away (a failed test's "you must either …", such as the Graveyard's) carries that choice in `DecisionView.followUps` (the engine reads the option's first command, resolving a test's deferred outcome as the queue would). Its row is picked like one with counts, its choice shows under it as pills, the first one picked, and Done sends both answers in one step (`GameActions.answer(option, counts, then)`), so one undo takes both back.
- `DecisionView.labels` gives the i18n key of each option whose name is not its own label (`does not provoke` is `decision.doesNotProvoke`).
- When several enemies attack the same investigator (an action that provokes several attacks of opportunity), each attack is its own decision; the dialog fans the next two attackers behind the card of the one it asks about (`DecisionView.waiting`: the subjects of the pending decisions with the same prompt and decider after it).
- An attack of opportunity also names the action that provoked it and waits for it (`DecisionView.provokedBy`, read from the held action in the queue: "Roland Banks takes a resource: Ghoul Priest attacks first"), so the players see why the enemy attacks.

The game cannot go on without an answer, so:

- Escape does not close it,
- Undo in it takes back the step that raised it,
- and its grab handle lowers it to a strip along the bottom (`CardDialog`'s `lowered` and `onLower`: the modal makes the board inert, so the lowered dialog is shown as a plain one), so the players can reach the board and its header, for example to adjust the board first; while they adjust, the dialog steps aside, and it comes back raised.

## In a details dialog

An action taken from an enemy's or location's details (fight, evade or engage; investigate) keeps the details open and shows the decisions it raises there (MD.6a4): [`DetailsDialog`](../../apps/web/src/screens/DetailsDialog.tsx) swaps the page for the decision's (`DecisionPage`, the same parts as the dialog's, with `decisionHeading` for its kicker and title) inside the same `CardDialog`, so the `<dialog>` stays open and the tapped card stays beside it; a decision about another card (another enemy's attack of opportunity) puts that card there instead. Once no decision is open the details' page comes back, read fresh from the board.

`GameScreen` shares the open decision and its id through `DecisionHostContext`; `useDecisionHost` hosts from the action's tap until the details close, and tells the screen at once, so the screen's own dialog stays shut meanwhile and takes a decision still open back when the details close. A decision already open before the details opened (the dialog lowered to look at the board) stays the screen's. A hosted decision offers no Pick on the map, and it lowers while the players adjust the board.

A decision whose options pick locations in play (where an enemy spawns or moves) names them in `DecisionView.locations` (option name → location, from `DecisionOption.target`). Its footer then offers **Pick on the map**: the dialog lowers and [`GameScreen`](../../apps/web/src/screens/GameScreen.tsx) passes `MapBoard` an `onPick` with those locations as `pickable`, which glow (`data-pickable`, the same glow as a spawn's tiles). A tap on one answers that option; a tap on another tile, on the lowered strip or on its handle raises the dialog again. Picking belongs to the decision it started for (`GameScreen` keeps its id), so the next decision opens raised.
