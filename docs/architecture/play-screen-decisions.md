# Play screen: decisions

The first open decision shows as a [dialog](../../apps/web/src/screens/DecisionDialog.tsx) over the board, on the card dialog shell ([play screen](play-screen.md), `CardDialog`):

- beside the page, the card the decision is about, else the encounter card whose revelation asks it (`DecisionView.card`, a `CardFaceView`),
- who decides, in the kicker with their portrait, over the translated question with the card it is about,
- when a revelation asks the players something, whom the card being resolved was drawn for and its keywords as badges ([`ResolvingCard`](../../apps/web/src/encounter/ResolvingCard.tsx), `BoardView.resolving`: the card in the `resolving` zone with the investigator its queued placement names and its keywords, a gained surge included),
- the test of a skill test,
- and a button per option, answered by its readable name (`GameActions.answer` maps it to the option).

A skill test one investigator takes also brings the test block the skill test dialog shares ([`TestCalculation.tsx`](../../apps/web/src/investigators/TestCalculation.tsx), MD.2b): `useSkillTest` keeps the run (skills, modifier, tokens drawn, `BoardView.skillTest`'s result) and `SkillTestBlock` shows it:

- the four skills as toggles with the investigator card's glyphs, starting on the test's skill; tapping another adds it (`SkillTestInput.addedSkill`), tapping the first then drops it, so the players can switch (a card can test another skill);
- the modifier, for committed cards and card effects (a difficulty stepper only in the panel's own test);
- the result strip (`ResultStrip`): the skill value's terms and their sum left, the tokens drawn in the middle with their sum when there are several ("?" for one the app cannot tell), PASS or FAIL over the total against the difficulty and the margin right.
The calculation marks the answer it works out and sends that one with its `margin`, while the other still overrides it (the screen keys the dialog by the decision's id, so a draw never carries over).

- An option's counts (`DecisionView.counts`: the clues a passed investigation discovers, the damage a passed fight deals, an attack's damage and horror) show as steppers within their limits on the row of their answer, which carries them as `amount` and `amounts`.
- `DecisionView.labels` gives the i18n key of each option whose name is not its own label (`does not provoke` is `decision.doesNotProvoke`).
- An attack of opportunity also names the action that provoked it and waits for it (`DecisionView.provokedBy`, read from the held action in the queue: "Roland Banks takes a resource: Ghoul Priest attacks first"), so the players see why the enemy attacks.

The game cannot go on without an answer, so:

- Escape does not close it,
- Undo in it takes back the step that raised it,
- and its "Adjust board" lets the players correct the board first (the dialog steps aside meanwhile, since the modal makes the board inert).
