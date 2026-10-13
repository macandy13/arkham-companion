# M5 – Core campaign

Goal: the full three-scenario introductory campaign of `core_2026`, with campaign log and chaos bag carried between scenarios.
Ref: architecture §8.

Model hint: **S** = Sonnet, **O** = Opus. Each task = one session = one PR.
Start from the phone: Code tab → repo → `Do task M5.x from docs/tasks/M5-core-campaign.md`.

---

## M5.1 Campaign model (O)

- [ ] `CampaignLog` (investigators, trauma, XP, killed/insane, story records, chaos bag) as its own event-sourced aggregate stored in the `campaigns` table
- [ ] Resolution steps: `record`, `addChaosToken`, `removeChaosToken`, `awardXp`, `addTrauma`
- [ ] `campaignSetup(log)` support in `compileSetup`

## M5.2 Campaign UI (S)

- [ ] New campaign flow in the wizard (investigators chosen once)
- [ ] Campaign screen: log, chaos bag, XP/trauma per investigator, next scenario button
- [ ] Resolution screen after a scenario: shows the steps for confirmation, then writes the log
- [ ] Picker opens only to replace killed/insane investigators

## M5.3 Scenario 2 (O)

- [ ] Data via the M4 pipeline (layout, connections), definition, special mechanics, setup test
- [ ] Reads earlier log entries in `campaignSetup`

## M5.4 Scenario 3 (O)

- [ ] Same as M5.3 for the final scenario, including campaign end

## M5.5 Campaign export/import and replay test (S)

- [ ] Export/import a whole campaign (log + games)
- [ ] Golden replay across all three scenarios

Done when: the intro campaign can be played end to end with log and chaos bag carried over.
