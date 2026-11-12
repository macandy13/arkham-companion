# Bless and curse tokens

Card rulings for [Skill tests](../skill-tests.md) and [Campaign](../campaign.md).
Bless and curse tokens come with The Innsmouth Conspiracy and are added by player cards in any campaign; they leave the bag in ways other tokens don't, so their rules live here.
Source: [RR "Bless and Curse Tokens"](https://arkhamdb.com/rules#Bless_and_Curse_Tokens) and the FAQ entries there.

## Pool

- At most 10 bless and 10 curse tokens are in the bag or sealed on cards at a time. The others sit in a pool beside the bag.
- "Add a bless token to the chaos bag" takes one from the pool. With too few left, the effect adds as many as it can (FAQ).
- As a cost, adding them can't be paid with too few left, so the card can't be played (FAQ). The app models no costs; the players check this.
- A sealed token counts toward the 10. Released, it goes back into the bag, not the pool.
- "Remove a bless token" puts one from the bag back in the pool.
- In the app: `ChangeChaosBag` adds none while `poolTokensLeft` is 0, and the chaos bag page turns its + off.

## Revealed

- In a skill test, bless gives +2 and curse −2, and each makes the tester reveal another token (see [Skill tests](../skill-tests.md)).
- At the end of the test (ST.8), a revealed bless or curse token goes back to the pool instead of into the bag.
- Revealed outside a skill test, they have no value and go back into the bag like any other token, unless a card says otherwise.
- In the app: the answer to a skill test the app drew for carries the tokens (`ResolveDecision.revealed`), and the bless and curse among them leave the bag. A test drawn at the table changes nothing; the players return them with the chaos bag's − button.

## Between scenarios

- Bless and curse tokens never carry over, whatever the card that added them said (FAQ). The engine records no campaign change for them.
- They stay in the bag while the resolution is read and leave it in cleanup, before any interlude (FAQ).
