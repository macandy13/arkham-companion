# Card abilities and modifiers

[Constant abilities](https://arkhamdb.com/rules#Constant_Abilities), [in play and out of play](https://arkhamdb.com/rules#In_Play_and_Out_of_Play), [modifiers](https://arkhamdb.com/rules#Modifiers); wording from [The Arkham Grimoire v1.1](https://images-cdn.fantasyflightgames.com/filer_public/4e/da/4eda7782-c983-47cc-8d9f-ae372a44d87b/arkham_grimoire_v11.pdf).

- A constant ability applies only while its card is in play.
  - Set-aside, removed, in-deck, in-hand, discarded and victory-display cards are out of play, so their abilities do nothing.
  - An attachment is in play while its host is.
- An unrevealed location has only its unrevealed side's text. Its revealed side's abilities ("each enemy at this location gets +1 fight") apply once it is revealed. This is our reading of "do not read the revealed side" (Grimoire, Location Cards); no rule says it in one sentence.
- A modified value is the printed value plus all active modifiers, applied together and recalculated whenever one starts or stops. A result below zero counts as zero.
- "Cannot" is absolute: no ability or effect overrides it ([Cannot](https://arkhamdb.com/rules#Cannot)). Card rulings: [Restrictions](cards/restrictions.md).
- An engaged enemy is at its investigator's location, so "each enemy at X" includes enemies engaged with investigators at X.
- An [action ability](https://arkhamdb.com/rules#Abilities) ("[action]: …") on an encounter or scenario card is taken as an action in the investigator's own turn. Who may take it depends on where the card is:
  - a location's by investigators at that location,
  - an enemy's by investigators at its location (engaged with it or not),
  - a card's in a threat area by investigators at that investigator's location,
  - and the current agenda's and act's by any investigator.
  - An unrevealed location offers none, as it has only its unrevealed side's text.
- [Limits](https://arkhamdb.com/rules#Limits_and_Maximums): "(Limit once per turn/game.)" counts each investigator's uses apart, "(Group limit once per game.)" everyone's together.
  - The engine counts "once per turn" by round, since card actions are taken only in the investigator's own turn and each investigator has one turn per round.
  - An action whose effect can't change the game state can't be taken ([Triggered Abilities](https://arkhamdb.com/rules#Triggered_Abilities)), so its limit isn't used up either: St. Mary's Hospital ("Heal 3 damage") with no damage isn't offered.
  - An action whose effect is done at the table (no effect the engine runs) is always offered.
- [Costs](https://arkhamdb.com/rules#Costs): the text before the colon ("Spend 5 resources:") is paid in full before the effect; an action whose cost can't be paid can't be taken.
  - Attacks of opportunity come after the costs are paid; the engine pays a card action's cost after them for now.
  - Card rulings: [Costs of card actions](cards/action-costs.md).
- "You must either A or B" (and "the lead investigator must decide") offers only the options that can change the game state ([Must](https://arkhamdb.com/rules#Must)):
  - with no clues, "spend 1 clue or take 2 damage" leaves only the damage,
  - and with no damage the Quiet Glade's "heal 1 damage or 1 horror" leaves only the horror.
  - An option done at the table (no effect the engine runs) always stays.
  - With neither possible, nothing happens ([Effects](https://arkhamdb.com/rules#Effects): resolve as much as you are able).
  - An option that resolves only in part is still allowed by the rule; the engine drops it for now (no Night of the Zealot card has one).
