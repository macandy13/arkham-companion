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
- `DecisionView.labels` gives the i18n key of each option whose name is not its own label (`does not provoke` is `decision.doesNotProvoke`).
- An attack of opportunity also names the action that provoked it and waits for it (`DecisionView.provokedBy`, read from the held action in the queue: "Roland Banks takes a resource: Ghoul Priest attacks first"), so the players see why the enemy attacks.

The game cannot go on without an answer, so:

- Escape does not close it,
- Undo in it takes back the step that raised it,
- and its grab handle lowers it to a strip along the bottom (`CardDialog`'s `lowerable`: the modal makes the board inert, so the lowered dialog is shown as a plain one), so the players can reach the board and its header, for example to adjust the board first; while they adjust, the dialog steps aside, and it comes back raised.
