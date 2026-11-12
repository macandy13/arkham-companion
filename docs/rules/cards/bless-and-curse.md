# Bless and curse tokens

Card rulings for [Skill tests](../skill-tests.md) and [Campaign](../campaign.md).
Bless and curse tokens come with The Innsmouth Conspiracy and are added by player cards in any campaign; they leave the bag in ways other tokens don't, so their rules live here.

## Pool

- There are 10 bless and 10 curse tokens. Those not in the bag or sealed on a card sit in a pool beside it.
- "Add a bless token to the chaos bag" takes one from the pool; with none left in it, nothing is added (the effect resolves as much as it can, "Golden Rules").
- A sealed token is still in play, so it does not go back to the pool until released and revealed.
- "Remove a bless token" puts one from the bag back in the pool.
- In the app: `ChangeChaosBag` adds none while `poolTokensLeft` is 0, and the chaos bag page shows the count beside its Add and Return buttons.

## Revealed in a skill test

- Bless gives +2 and curse −2, and each makes the tester reveal another token (see [Skill tests](../skill-tests.md)).
- After the test, a revealed bless or curse token goes back to the pool, not into the bag.
- In the app: the answer to a skill test the app drew for carries the tokens (`ResolveDecision.revealed`), and the bless and curse among them leave the bag. A test drawn at the table changes nothing; the players return them with the chaos bag's Return button.

## Between scenarios

- Bless and curse tokens never carry over: the next scenario's bag starts without them, whatever the card that added them said (FAQ). The engine records no campaign change for them.
