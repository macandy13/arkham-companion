# Card abilities and modifiers

[Constant abilities](https://arkhamdb.com/rules#Constant_Abilities), [in play and out of play](https://arkhamdb.com/rules#In_Play_and_Out_of_Play), [modifiers](https://arkhamdb.com/rules#Modifiers); wording from [The Arkham Grimoire v1.1](https://images-cdn.fantasyflightgames.com/filer_public/4e/da/4eda7782-c983-47cc-8d9f-ae372a44d87b/arkham_grimoire_v11.pdf).

- A constant ability applies only while its card is in play.
  Test: `packages/engine/src/modifiers.test.ts › effectiveValue with a modifier of each enemy › gives nothing while the agenda waits under the current one: the ghoul keeps fight 3`
  Test: `packages/engine/src/enemy_damage_restrictions.test.ts › an enemy that cannot be damaged at a location with Fire! attached › damages the ghoul in the hall again once the agenda has left play`
  - Set-aside, removed, in-deck, in-hand, discarded and victory-display cards are out of play, so their abilities do nothing.
  - A card placed beneath a location or the act is out of play too, face down unless the effect says otherwise: our reading of [In Play and Out of Play](https://arkhamdb.com/rules#In_Play_and_Out_of_Play) (only cards in a threat area or at a location are in play), as the Smoke and Mirrors guide separates "in play" from "beneath a location". Moving an in-play card there makes it leave play.
    Test: `packages/engine/src/engine.test.ts › MoveCard out of play › moves the ghoul beneath the hall without its damage, as cards beneath another are out of play`
    Test: `packages/engine/src/board_view.test.ts › locations › counts the facedown cards beneath a location, never naming them`
  - An attachment is in play while its host is.
- A card that leaves play loses its tokens, its attachments are discarded and lasting effects on it expire ([Leaves Play](https://arkhamdb.com/rules#Leaves_Play)): Escape the Dorms removes Your Friend's Room with its Fire! and sets the Servant of Flame aside without its damage.
  Test: `packages/engine/src/engine.test.ts › MoveCard out of play › discards what is attached to the hall and its clues when it is removed from the game`
  Test: `packages/engine/src/engine.test.ts › MoveCard out of play › sets the ghoul aside without its damage`
  - Cards enter play ready ([Ready](https://arkhamdb.com/rules#Ready)), so a Servant of Flame evaded before it was set aside engages again when act 3 puts it into play.
    Test: `packages/engine/src/engine.test.ts › MoveCard out of play › readies an exhausted ghoul it sets aside, as cards enter play ready`
  - The app does this whenever an effect moves a card out of play (to the discard, a deck, the victory display, set aside, out of the game or beneath a card); a correction by hand moves the card alone.
- An unrevealed location has only its unrevealed side's text. Its revealed side's abilities ("each enemy at this location gets +1 fight") apply once it is revealed. This is our reading of "do not read the revealed side" (Grimoire, Location Cards); no rule says it in one sentence.
  Test: `packages/engine/src/board_view.test.ts › locations › the parlor's printed actions › are not printed on its unrevealed side`
  Test: `packages/engine/src/modifiers.test.ts › effectiveValue with a modifier of the card itself › adds the shroud a revealed location gives itself: 2 + 1`
- A modified value is the printed value plus all active modifiers, applied together and recalculated whenever one starts or stops. A result below zero counts as zero.
  Test: `packages/engine/src/modifiers.test.ts › effectiveValue › never goes below 0, e.g. -5 shroud on the study (shroud 3)`
  Test: `packages/engine/src/modifiers.test.ts › skillValues › never goes below 0: intellect 2 with -5`
- "Cannot" is absolute: no ability or effect overrides it ([Cannot](https://arkhamdb.com/rules#Cannot)). Card rulings: [Restrictions](cards/restrictions.md).
- An engaged enemy is at its investigator's location, so "each enemy at X" includes enemies engaged with investigators at X.
  Test: `packages/engine/src/conditions.test.ts › an effect on each card in play at your location › places doom only on the Cultist in the hall with alice`
- An [action ability](https://arkhamdb.com/rules#Abilities) ("[action]: …") on an encounter or scenario card is taken as an action in the investigator's own turn. Who may take it depends on where the card is:
  Test: `packages/engine/src/card_actions.test.ts › UseCardAction › lets bob take the action of $name`
  Test: `packages/engine/src/card_actions.test.ts › UseCardAction › rejects bob taking the action of $name`
  - a location's by investigators at that location,
  - an enemy's by investigators at its location (engaged with it or not),
  - a card's in a threat area by investigators at that investigator's location,
  - a card's attached to a location (Locked Door, Arcane Lock) by investigators at that location ([Triggered Abilities](https://arkhamdb.com/rules#Triggered_Abilities): "a scenario card that is in play and at the same location as the investigator"),
  - and the current agenda's and act's by any investigator.
  - An unrevealed location offers none, as it has only its unrevealed side's text.
- A [reaction ability](https://arkhamdb.com/rules#Triggered_Abilities) ("[reaction] After you discover clues here: …") is optional: the investigator it names ("you", the one who met its condition) may use it or pass.
  Test: `packages/engine/src/triggers.test.ts › a reaction the investigator may use or pass › asks alice, who discovered the clue, to use the bank's reaction or pass`
  Test: `packages/engine/src/triggers.test.ts › a reaction the investigator may use or pass › gives alice $resources resources when she answers $answered`
  - It may be used once each time its condition is met, within its limit.
    Test: `packages/engine/src/triggers.test.ts › a reaction the investigator may use or pass › offers it to alice again after she passed`
    Test: `packages/engine/src/triggers.test.ts › a reaction the investigator may use or pass › rejects a second use by alice in the same round`
  - A location's reaction, like its actions above, is open only to investigators at that location.
    Test: `packages/engine/src/triggers.test.ts › a reaction the investigator may use or pass › offers the vault reaction at the end of her turn to alice $where: $asked`
  - [Forced abilities](timing-of-forced-effects.md) on the same timing point resolve before reactions to it.
    Test: `packages/engine/src/triggers.test.ts › a reaction the investigator may use or pass › resolves a forced ability on the same discovery before it asks about the reaction`
- [Limits](https://arkhamdb.com/rules#Limits_and_Maximums): "(Limit once per turn/round/phase/game.)" counts each investigator's uses apart, "(Group limit once per game.)" everyone's together; "twice per round" allows two.
  Test: `packages/engine/src/card_actions.test.ts › action limits › rejects a second use in the same turn with a limit once per $per`
  Test: `packages/engine/src/card_actions.test.ts › limits of a free action › allows two uses in a turn, not three, when limited twice per round`
  - A turn is one investigator's turn: a free action taken in alice's turn and again in bob's is used once in each turn.
  - Engine convention (no official ruling found): outside every turn (a free action in the mythos or enemy phase) the uses of one phase count as one turn, since no turn is in progress to tell them apart.
    Test: `packages/engine/src/card_actions.test.ts › limits of a free action › counts the uses outside every turn in one phase as one turn: once per turn in the enemy phase`
  - A card that leaves play and comes back is a new instance with fresh uses.
  - "Max X per period" counts the uses of all copies of a card (by title) for all players; no scenario card has one yet, so the engine has no maximum.
  - An action whose effect can't change the game state can't be taken ([Triggered Abilities](https://arkhamdb.com/rules#Triggered_Abilities)), so its limit isn't used up either: St. Mary's Hospital ("Heal 3 damage") with no damage isn't offered.
    Test: `packages/engine/src/card_actions.test.ts › actions that would change nothing › neither offers nor accepts healing alice with no damage`
    Test: `packages/engine/src/card_actions.test.ts › actions that would change nothing › offers and heals alice with 1 damage`
  - An action whose effect is done at the table (no effect the engine runs) is always offered.
  - The rule holds for every triggered ability, reactions included; Arkham Sanatorium's reaction stays offered with no horror to heal, since its [[Ally]] half is done at the table.
- [Costs](https://arkhamdb.com/rules#Costs): the text before the colon ("Spend 5 resources:") is paid in full before the effect; an action whose cost can't be paid can't be taken.
  Test: `packages/engine/src/card_actions.test.ts › action costs › makes alice with 5 resources pay 2 before the action scares her`
  Test: `packages/engine/src/card_actions.test.ts › action costs › neither offers nor accepts the action from alice with 1 resource`
  - Attacks of opportunity come after the costs are paid; the engine pays the action itself before them, but the card's clue or resource cost after them for now.
  - Card rulings: [Costs of card actions and basic actions](cards/action-costs.md).
- An effect's target must be one it would change ([Target](https://arkhamdb.com/rules#Target)): "heal 1 horror from an investigator at this location" offers only those with horror, and heals the only one without asking.
  Test: `packages/engine/src/triggers.test.ts › an effect on an investigator the window investigator picks › heals alice without asking when bob there has no horror to heal`
  Test: `packages/engine/src/triggers.test.ts › an effect on an investigator the window investigator picks › heals alice without asking when she is the only one there`
- "You must either A or B" (and "the lead investigator must decide") offers only the options that can change the game state ([Must](https://arkhamdb.com/rules#Must)):
  Test: `packages/engine/src/triggers.test.ts › a choice without the options that cannot be resolved › offers alice with $clues clues only the options that can be resolved`
  Test: `packages/engine/src/triggers.test.ts › a choice whose options are offered only while their condition holds › with $damage damage and $horror horror alice takes the one she has more of, unasked`
  - with no clues, "spend 1 clue or take 2 damage" leaves only the damage,
  - and with no damage the Quiet Glade's "heal 1 damage or 1 horror" leaves only the horror.
  - With an empty hand, Umôrdhoth's Wrath's "discard a card" can't be chosen, so each point costs 1 damage and 1 horror; the engine doesn't track hands, so the players keep to this at the table.
  - Without an asset, Unnatural Decay's "place 1 doom on an asset you control" can't be chosen, so its drawer takes the 2 damage; the engine doesn't track assets, so the players keep to this at the table.
  - An option done at the table (no effect the engine runs) always stays.
  - With neither possible, nothing happens ([Effects](https://arkhamdb.com/rules#Effects): resolve as much as you are able).
    Test: `packages/engine/src/triggers.test.ts › a choice without the options that cannot be resolved › asks nothing when alice can resolve no option`
    Test: `packages/engine/src/triggers.test.ts › a choice whose options are offered only while their condition holds › does nothing when no option holds`
  - An option that resolves only in part is still allowed by the rule; the engine drops it for now (no Night of the Zealot card has one).
