# M4 – Scenario data pipeline + first scenario

Goal: a repeatable way to turn a real scenario into data (product.md "Scenario data pipeline"), then _Spreading Flames_ fully playable.

**Why this milestone**

- **Problem:** The engine is generic, but a real scenario needs its map layout, location connections and special rules. ArkhamDB has no connection or layout data, and typing it by hand for every scenario does not scale.
- **What the app gains:** A repeatable data pipeline (import → extract → review → fix in-app) plus the first real, table-ready scenario. The pipeline is reused for every later scenario (M5, M7).
- **Why at this point:** Engine and UI are already proven with the sandbox, so anything that breaks now is data or scenario rules – much easier to diagnose.

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

## M4.4 Spreading Flames: definition (O)

**Why:** Brings the pipeline's outputs together into the first real scenario definition. The setup test against real quantities catches data drift.

**Benefit:** One-tap setup of _Spreading Flames_.

Ref: architecture "Scenarios".

- [ ] `ScenarioDefinition` for `core2026-spreading-flames`: encounter sets, agenda/act decks, maps from M4.1, connections from M4.2
- [ ] Setup steps and set-aside cards; setup test against ArkhamDB quantities (via cached data, skipped offline)

## M4.5 Spreading Flames: special mechanics (O)

**Why:** Every scenario has rules the generic engine does not cover. Implementing them shows which ones should become engine primitives (architecture "Overview", "generic before specific").

**Benefit:** The scenario plays correctly, not just its setup.

- [ ] Skull token value depends on the act number
- [ ] `drawTopmostFromDiscard('Fire!')` uses; agenda 2 adds set-aside _Fire!_ copies to the discard
- [ ] Parley action on agendas to discard a bystander enemy at a location (`ScenarioAction`)
- [ ] Agenda 3 forced effect via `afterDoomPlaced`
- [ ] Reverse-side hooks and resolutions (record only; campaign log comes in M5)

## M4.6 Real-card UI pass (S)

**Why:** The sandbox used fake cards; real cards need images and a readable fallback when an image is missing.

**Benefit:** The app looks and reads like the actual game.

- [ ] Card images and text fallback from ArkhamDB in all panels
- [ ] Encounter cards show keywords and "resolve" quick actions for the scenario's cards

## M4.7 Playtest checklist (S)

**Why:** Real playtests find problems that tests miss; a checklist makes a playtest evening efficient.

**Benefit:** Documented known gaps and a regression replay for the first real scenario.

- [ ] Golden replay of a scripted _Spreading Flames_ game
- [ ] Write `docs/playtests/spreading-flames.md`: what to check at the table, known gaps
- [ ] Note follow-ups in this file

Done when: _Spreading Flames_ can be played at the table from setup to resolution.
