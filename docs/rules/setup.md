# Setup

[Setting up the game](https://arkhamdb.com/rules#Appendix_III_Setting_Up_The_Game), in order:

- Choose investigators; in a campaign each starts with damage equal to their physical trauma and horror equal to their mental trauma;
  Test: [`packages/engine/src/setup.test.ts › compileSetup in a campaign › starts each investigator with damage for physical and horror for mental trauma`](../../packages/engine/src/setup.test.ts#L622)
- Choose the lead investigator;
- Shuffle decks;
- Build the chaos bag from the campaign (or keep the previous scenario's bag);
  Test: [`packages/engine/src/setup.test.ts › compileSetup › copies identity, difficulty, seed and the chaos bag for the difficulty`](../../packages/engine/src/setup.test.ts#L56)
  Test: [`packages/engine/src/setup.test.ts › compileSetup in a campaign › takes the difficulty and the chaos bag from the log and passes the log on`](../../packages/engine/src/setup.test.ts#L608)
- Each investigator gains 5 resources and draws 5 cards with one optional mulligan (weaknesses drawn now are set aside, replaced, and shuffled back afterwards);
- Then the scenario setup (locations, starting positions, set-aside cards, encounter deck);
- Agenda and act decks in order with 1a on top;
  Test: [`packages/engine/src/setup.test.ts › compileSetup › puts agendas and acts into their decks in order, side a up`](../../packages/engine/src/setup.test.ts#L76)
- Scenario reference card.

There are no player windows during setup.
[Surge](encounter-draws.md) still applies to cards drawn during setup.

Setup's own placements and engagements are not game events, so no "after" ability fires for them (our reading; no rule says so), with one ruled exception: a forced "after it enters play" ability still triggers for an enemy spawned during setup ([FAQ, Acolyte](https://arkhamdb.com/card/01169): it gets its 1 doom), so the setup step places those tokens itself.
Test: [`packages/engine/src/triggers.test.ts › trigger bus › abilities after an engagement or a clue discovery › opens no window for an enemy engaged at setup`](../../packages/engine/src/triggers.test.ts#L922)
Test: [`packages/engine/src/setup.test.ts › compileSetup › spawns an enemy with the doom its "after it enters play" ability places`](../../packages/engine/src/setup.test.ts#L178)
