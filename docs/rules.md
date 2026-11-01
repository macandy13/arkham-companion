# Rules summary

The game rules the engine implements, summarised in our own words so sessions don't have to search and re-read the Rules Reference.
Each topic page links to its section on [ArkhamDB's copy of the Rules Reference](https://arkhamdb.com/rules); fetch that anchor when exact wording matters.

**Source and scope.**

- ArkhamDB mirrors the Chapter One Rules Reference with FAQ rulings up to v2.5. It does not cover the 2026 Core Set (Chapter Two).
- Where Chapter Two may differ, check the official 2026 rules and note the difference on the topic's page.
- Only scenario-side rules are listed; player-card rules (deckbuilding, slots, costs) are out of scope.

**Never paste rules text into these pages.** The Rules Reference is copyrighted. Keep entries as short paraphrases with an anchor link, and update an entry in the same PR that changes the rule in code.

**One page per topic.**

- Each topic below has its own page in [`rules/`](rules/), so PRs that touch different rules don't conflict.
- A PR edits its topic's page; this page changes only when a topic or card group is added.
- Refer to topics by name (rules "Act and clues").

**Card rulings.** A ruling for one named card goes to its group's page in [`rules/cards/`](rules/cards/), grouped by mechanic, not by scenario, so later campaigns add cards to the groups.

- The topic page keeps the general rule and links to the group ("Card rulings: …").
- A group page starts with the principle its cards share, then one list item per card: the card text in short, our ruling and its source.
- A card named in parentheses as an example of a general rule ("Obscuring Fog's +2 shroud") stays on the topic page.

**Shape of a page.** Keep paragraphs short and put enumerations into Markdown lists, one item per line, so parallel PRs that add to a page don't conflict (`docs/coding-guidelines.md` §8).

## Topics

- [Precedence](rules/precedence.md)
- [Timing of forced effects](rules/timing-of-forced-effects.md)
- [Round structure](rules/round-structure.md)
- [Setup](rules/setup.md)
- [Agenda and doom](rules/agenda-and-doom.md)
- [Act and clues](rules/act-and-clues.md)
- [Per-investigator values](rules/per-investigator-values.md)
- [Encounter draws](rules/encounter-draws.md)
- [Spawn and engagement](rules/spawn-and-engagement.md)
- [Hunter](rules/hunter.md)
- [Prey](rules/prey.md)
- [Enemy keywords](rules/enemy-keywords.md)
- [Investigator actions against enemies](rules/investigator-actions-against-enemies.md)
- [Card abilities and modifiers](rules/card-abilities-and-modifiers.md)
- [Skill tests](rules/skill-tests.md)
- [Damage, horror and defeat](rules/damage-horror-and-defeat.md)
- [Elimination and resign](rules/elimination-and-resign.md)
- [Campaign](rules/campaign.md)

## Card rulings

- [Restrictions ("cannot")](rules/cards/restrictions.md)
- [Objectives and special acts and agendas](rules/cards/objectives.md)
- [Costs of card actions and basic actions](rules/cards/action-costs.md)
- [Story assets and earned cards](rules/cards/story-assets.md)
- [Searching, drawing and attaching encounter cards](rules/cards/encounter-searches.md)
- [Resolution order](rules/cards/resolution-order.md)
- [Children of Blood](rules/cards/children-of-blood.md)
