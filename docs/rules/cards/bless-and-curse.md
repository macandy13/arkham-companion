# Bless and curse tokens

Card rulings for [Skill tests](../skill-tests.md) and [Campaign](../campaign.md).
Bless and curse tokens come with The Innsmouth Conspiracy and are added by player cards in any campaign; they leave the bag in ways other tokens don't, so their rules live here.
Source: [RR "Bless and Curse Tokens"](https://arkhamdb.com/rules#Bless_and_Curse_Tokens) and the FAQ entries there.

## Pool

- At most 10 bless and 10 curse tokens are in the bag or sealed on cards at a time. The others sit in a pool beside the bag.
  Test: [`packages/engine/src/chaos_bag.test.ts › bless and curse tokens › leaves $left bless tokens in the pool: $name`](../../../packages/engine/src/chaos_bag.test.ts#L183)
- "Add a bless token to the chaos bag" takes one from the pool. With too few left, the effect adds as many as it can (FAQ).
  Test: [`packages/engine/src/chaos_bag.test.ts › bless and curse tokens › $name`](../../../packages/engine/src/chaos_bag.test.ts#L191)
- As a cost, adding them can't be paid with too few left, so the card can't be played (FAQ). The app models no costs; the players check this.
- A sealed token counts toward the 10. Released, it goes back into the bag, not the pool.
  Test: [`packages/engine/src/chaos_bag.test.ts › bless and curse tokens › leaves $left bless tokens in the pool: $name`](../../../packages/engine/src/chaos_bag.test.ts#L183)
- "Remove a bless token" puts one from the bag back in the pool.
- In the app: `ChangeChaosBag` adds none while `poolTokensLeft` is 0, and the chaos bag page turns its + off.

## Revealed

- In a skill test, bless gives +2 and curse −2, and each makes the tester reveal another token (see [Skill tests](../skill-tests.md)).
- At the end of the test (ST.8), a revealed bless or curse token goes back to the pool instead of into the bag.
  Test: [`packages/engine/src/chaos_bag.test.ts › bless and curse tokens › revealed in a skill test › $name`](../../../packages/engine/src/chaos_bag.test.ts#L250)
- Cancelled or ignored in its entirety, a bless or curse token counts as never revealed, so it goes back into the bag, not the pool. No ruling says so directly; it is our reading of the Counterspell FAQ ("as if it had never been revealed"). The app sends only the resolved tokens as `revealed`.
  Test: [`packages/engine/src/draw_tokens.test.ts › a test draw › lists every drawn token, and as revealed only the resolved ones as they came out`](../../../packages/engine/src/draw_tokens.test.ts#L92)
- Revealed outside a skill test, they have no value and go back into the bag like any other token, unless a card says otherwise.
- In the app: the answer to a skill test the app drew for carries the tokens (`ResolveDecision.revealed`), and the bless and curse among them leave the bag. A test drawn at the table changes nothing; the players return them with the chaos bag's − button.

## Between scenarios

- Bless and curse tokens never carry over, whatever the card that added them said (FAQ). The engine records no campaign change for them.
  Test: [`packages/engine/src/chaos_bag.test.ts › bless and curse tokens › keeps a curse token added for the campaign out of the campaign log`](../../../packages/engine/src/chaos_bag.test.ts#L207)
- They stay in the bag while the resolution is read and leave it in cleanup, before any interlude (FAQ).
