# M4 – Scenario data pipeline + first scenario

Goal: a repeatable way to turn a real scenario into data (architecture §5 "Where scenario data comes from"), then *Spreading Flames* fully playable.

Model hint: **S** = Sonnet, **O** = Opus. Each task = one session = one PR.
Start from the phone: Code tab → repo → `Do task M4.x from docs/tasks/M4-scenario-data-first-scenario.md`.

Rule: nothing from ArkhamDB or ArkhamCards is committed except card codes, symbol names and our own layout/override files.

---

## M4.1 ArkhamCards import (S)

- [ ] Script fetches the campaign guide JSON for the scenario from `zzorba/arkham-cards-data` (build-time, cached in `.cache/`, gitignored)
- [ ] Extract `location_setup` grids (rows of codes, arrows, annotations) → slots for `ScenarioDefinition.maps`
- [ ] Extract chaos bag per difficulty, setup card lists, set-aside cards where present
- [ ] Report what was found and what is missing per scenario

## M4.2 Connection symbol extraction (O)

- [ ] Script downloads location images (front and back) for a pack and builds a contact sheet (one image per location, code printed)
- [ ] Extraction task: read each location image, record `{ code, side, symbol, connectsTo[] }`; symbol names come from a fixed enum (`LocationSymbol`) collected from the pack first
- [ ] Output `packages/scenarios/data/connections/<pack>.json` (codes and symbol names only)
- [ ] Review step: render the resulting graph next to the contact sheet; fix by hand before merge
- [ ] Engine reads symbol data into the connection graph (front vs back symbols for unrevealed/revealed)

## M4.3 Manual connection editor (S)

- [ ] Board edit mode: add/remove connections, set a location's symbol, drag slots
- [ ] Saves a scenario override (IndexedDB) applied on top of imported data
- [ ] Export overrides as JSON to commit into `packages/scenarios/data/overrides/`

## M4.4 Spreading Flames: definition (O)

Ref: §7 example.

- [ ] `ScenarioDefinition` for `core2026-spreading-flames`: encounter sets, agenda/act decks, maps from M4.1, connections from M4.2
- [ ] Setup steps and set-aside cards; setup test against ArkhamDB quantities (via cached data, skipped offline)

## M4.5 Spreading Flames: special mechanics (O)

- [ ] Skull token value depends on the act number
- [ ] `drawTopmostFromDiscard('Fire!')` uses; agenda 2 adds set-aside *Fire!* copies to the discard
- [ ] Parley action on agendas to discard a bystander enemy at a location (`ScenarioAction`)
- [ ] Agenda 3 forced effect via `afterDoomPlaced`
- [ ] Reverse-side hooks and resolutions (record only; campaign log comes in M5)

## M4.6 Real-card UI pass (S)

- [ ] Card images and text fallback from ArkhamDB in all panels
- [ ] Encounter cards show keywords and "resolve" quick actions for the scenario's cards

## M4.7 Playtest checklist (S)

- [ ] Golden replay of a scripted *Spreading Flames* game
- [ ] Write `docs/playtests/spreading-flames.md`: what to check at the table, known gaps
- [ ] Note follow-ups in this file

Done when: *Spreading Flames* can be played at the table from setup to resolution.
