# M4 – Scenario data pipeline + first scenario

Goal: a repeatable way to turn a real scenario into data (product.md "Scenario data pipeline"), then _The Gathering_, the first scenario of _Night of the Zealot_, fully playable from real card data.

**Why this milestone**

- **Problem:** The engine is generic, but a real scenario needs its map layout, location connections and special rules. ArkhamDB has no connection or layout data, and typing it by hand for every scenario does not scale.
- **What the app gains:** A repeatable data pipeline (import → extract → review → fix in-app) plus the first real, table-ready scenario. The pipeline is reused for every later scenario (M5, M7).
- **Why _Night of the Zealot_ first:** the engine already plays a hand-written _The Gathering_ in tests, and the campaign's 80 encounter cards need most of the generic rules (steps 1–12 of the [encounter card plan](../encounter-card-analysis.md#implementation-plan)). Those rules also cover half of every later campaign. The Chapter Two campaigns follow in M7.
- **Why at this point:** Engine and UI are already proven with the sandbox, so anything that breaks now is data or scenario rules – much easier to diagnose.

Order: plan step 1 (card data for every pack, from M4.5) comes first, because the pipeline and _The Gathering_ need the `core` pack loaded.

Rule: nothing from ArkhamDB or ArkhamCards is committed except card codes, symbol names and our own layout/override files.

---

## M4.1 ArkhamCards import (S)

**Why:** ArkhamCards already encodes book layouts and chaos bags; importing them avoids hand-typing and its errors. It is used at build time only and not committed, because that repo has no licence.

**Benefit:** Maps that match the scenario book, and a report that shows exactly what still has to be filled in.

- [ ] Script fetches the campaign guide JSON for the scenario from `zzorba/arkham-cards-data` (build-time, cached in `.cache/`, gitignored)
- [ ] Extract `location_setup` grids (rows of codes, arrows, annotations) → slots for `ScenarioDefinition.maps`
- [ ] Extract chaos bag per difficulty, setup card lists, set-aside cards where present
- [ ] Report what was found and what is missing per scenario

## M4.2 Connection symbol extraction (O)

**Why:** Connection symbols exist only on the card images, yet they decide movement and hunter paths. A one-time extraction per pack with a human review is cheaper than typing and safer than trusting a model blindly.

**Benefit:** Correct connections for every location, committed as tiny JSON files without any copyrighted content.

- [ ] Script downloads location images (front and back) for a pack and builds a contact sheet (one image per location, code printed)
- [ ] Extraction task: read each location image, record `{ code, side, symbol, connectsTo[] }`; symbol names come from a fixed enum (`LocationSymbol`) collected from the pack first
- [ ] Output `packages/scenarios/data/connections/<pack>.json` (codes and symbol names only)
- [ ] Review step: render the resulting graph next to the contact sheet; fix by hand before merge
- [ ] Engine reads symbol data into the connection graph (front vs back symbols for unrevealed/revealed)

## M4.3 Manual connection editor (S)

**Why:** Extraction will make mistakes, and some data will be missing. An in-app editor fixes it without code changes.

**Benefit:** Anyone can correct a map at the table, and the fixes can flow back into the repo for everyone.

- [ ] Board edit mode: add/remove connections, set a location's symbol, drag slots
- [ ] Saves a scenario override (IndexedDB) applied on top of imported data
- [ ] Export overrides as JSON to commit into `packages/scenarios/data/overrides/`

## M4.4 The Gathering: definition (O)

**Why:** Brings the pipeline's outputs together into the first real scenario definition. The setup test against real quantities catches data drift.

**Benefit:** One-tap setup of _The Gathering_ from real card data.

Ref: architecture "Scenarios".

- [ ] `ScenarioDefinition` for _The Gathering_ (`core` pack): encounter sets, agenda/act decks, maps from M4.1, connections from M4.2. under its own ID, apart from the hand-written test scenario in `packages/scenarios/src/the_gathering/`, which stays the only source of test data
- [ ] Setup steps and set-aside cards; setup test against ArkhamDB quantities (via cached data, skipped offline)
- [ ] One `CardDb` for every card: map carddata's cached `CardDef`s to engine `CardStats` (investigators included) and build the app's `CardDb` from all of them, picture paths included (`imageSrc`/`backImageSrc`, which the map and header cards show, M3.10c), so scenario packages only add hand-entered extras on top and the wizard no longer joins two sources with `cardDbWith` (Andy on #77)

## M4.5 Night of the Zealot rules (O, one task per step)

Steps 1–12 of the [encounter card plan](../encounter-card-analysis.md#implementation-plan), each one task of one or a few small PRs, in plan order. Each step names the _Night of the Zealot_ cards it is built for and adds them to an end-to-end scenario test.

**Why:** these generic rules are what _Night of the Zealot_'s cards need beyond today's engine. Building them first as engine primitives keeps the three scenarios mostly data (architecture "Overview", "generic before specific").

**Benefit:** _The Gathering_ plays correctly, not just its setup, and half of every later campaign's encounter cards work too.

- [x] 1 Card data for every pack (read the chapter from the data; load `core`). Done: packs take the data's `chapter` field, with `CHAPTER_TWO_PACK_CODES` (now with `cob`) as the fallback; `carddata:fetch` loads `core`, `core_2026` and `cob`.
- [ ] 2 Timing windows. Architecture review P1 built the frame: card and scenario abilities in `CardStats.abilities` with `TimingWindow`s (revealed, end of your turn, end of round, advanced, enemy defeated as an objective); the code hooks are gone. The plan's other windows are still open, in three PRs:
  - [x] 2a "After you enter" a location (`afterEntering`): the Attic's horror and the Cellar's damage. "When you would leave" (Arkham Woods: Twisting Paths) cancels the move, so it waits for a cancellable window.
  - [x] 2b A phase's end (`atEndOfPhase`: Wizard of the Order, They're Getting Out!) and an investigator's turn start (`whenTurnBegins`). No Night of the Zealot card names a phase's start, so that window waits for one. "At the end of each investigator's turn" for cards outside a threat area waits for step 7 with Umôrdhoth.
  - [x] 2c1 After an investigation, fight or evade succeeds or fails (`afterTest`): Obscuring Fog's discard becomes an ability and `LocationAttachment.discardWhenInvestigated` is gone. A card's own test ("after you fail a test by 2 or more") waits for a card that needs it.
  - [x] 2c2 After an enemy engages you (`afterEngaging`, either way round) and after you discover clues at a location (`afterDiscoveringClues`).
  - [x] 2c3a After an enemy attacks you (`afterAttacking`): attacks now record `EnemyAttacked`, naming the enemy; attacks of opportunity count, and in the enemy phase the enemy exhausts only after those abilities (`exhaustAfterAttack`). No Night of the Zealot card uses it yet: Yithian Observer's "when it attacks you" changes the attack itself and waits for a "when" window before damage.
  - [x] 2c3b "When [this enemy] is defeated" (`whenDefeated`): `EnemyDefeated` records where the enemy was, and `eachInvestigatorAt(itsLocation())` names each investigator there (Goat Spawn).
  - [ ] 2c3c After doom is placed and after you resolve another treachery. No Night of the Zealot card uses either, so both wait for the Chapter Two step that adds the cards needing them (Echoing in Darkness, "would advance" in step 18).
- [x] 3 Skill test margin. Done by P2: `ResolveDecision.margin`, the suggestion's `margin`, `SkillTestResolved.margin` and per-point fails (#201).
- [ ] 4 Choose one, in two PRs:
  - [x] 4a `youMustEither` (the drawer chooses) next to `leadDecides`; an option's player-card part is only in its label. Agenda 1 (What's Going On?!) asks the lead: each investigator discards a random card at the table, or the lead takes 2 horror. Offer of Power fits as is once its card data lands.
  - [ ] 4b Options that need something (Hunting Shadow: "you must either spend 1 clue or take 2 damage"; check the Rules Reference on choosing an option you cannot resolve first), and Graveyard's "if you fail, you must either take 2 horror or move to Rivertown" (a test whose fail outcome is a choice).
- [ ] 5 Card effects for existing commands, healing, conditional surge
- [ ] 6 Board queries (nearest, most clues, no doom; moving toward; search by trait)
- [ ] 7 Keyword details (prey, spawn filters, per-investigator values)
- [ ] 8 Scenario actions (costs, tests, Parley, Resign, limits)
- [ ] 9 Constant modifiers and restrictions
- [ ] 10 Location attachments with targets
- [ ] 11 Objective conditions and clue placement
- [ ] 12 Campaign-specific setup and flow

## M4.6 Real-card UI pass (S)

**Why:** The sandbox used fake cards; real cards need images and a readable fallback when an image is missing.

**Benefit:** The app looks and reads like the actual game.

- [ ] Card images and text fallback from ArkhamDB in all panels
- [ ] Encounter cards show keywords and "resolve" quick actions for the scenario's cards

## M4.7 Playtest checklist (S)

**Why:** Real playtests find problems that tests miss; a checklist makes a playtest evening efficient.

**Benefit:** Documented known gaps and a regression replay for the first real scenario.

- [ ] Golden replay of a scripted _The Gathering_ game
- [ ] Write `docs/playtests/the-gathering.md`: what to check at the table, known gaps
- [ ] Note follow-ups in this file

Done when: _The Gathering_ can be played at the table from setup to resolution.
