# Play screen: decisions

The first open decision shows as a [dialog](../../apps/web/src/screens/DecisionDialog.tsx) over the board:

- the encounter card being resolved, when a revelation asks the players something ([`ResolvingCard`](../../apps/web/src/encounter/ResolvingCard.tsx), `BoardView.resolving`: the card in the `resolving` zone with the investigator its queued placement names and its keywords, a gained surge included), large with whom it was drawn for and its keywords as badges,
- then the translated question with the card it is about,
- who decides,
- the test of a skill test,
- and a button per option, answered by its readable name (`GameActions.answer` maps it to the option).

A skill test one investigator takes also brings the skill test dialog's skill toggles (starting on the test's skill, since a card can test another), modifier, draw and calculation (the shared [`TestCalculation.tsx`](../../apps/web/src/investigators/TestCalculation.tsx)).
The calculation marks the answer it works out and sends that one with its `margin`, while the other still overrides it (the screen keys the dialog by the decision's id, so a draw never carries over).

- An option's counts (`DecisionView.counts`: the clues a passed investigation discovers, the damage a passed fight deals, an attack's damage and horror) show as steppers within their limits on the row of their answer, which carries them as `amount` and `amounts`.
- `DecisionView.labels` gives the i18n key of each option whose name is not its own label (`does not provoke` is `decision.doesNotProvoke`).
- An attack of opportunity also names the action that provoked it and waits for it (`DecisionView.provokedBy`, read from the held action in the queue: "Roland Banks takes a resource: Ghoul Priest attacks first"), so the players see why the enemy attacks.

The game cannot go on without an answer, so:

- Escape does not close it,
- Undo in it takes back the step that raised it,
- and its "Adjust board" lets the players correct the board first (the dialog steps aside meanwhile, since the modal makes the board inert).
