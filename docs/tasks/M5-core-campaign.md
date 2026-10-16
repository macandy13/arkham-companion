# M5 – Core campaign

Goal: the full three-scenario introductory campaign of `core_2026`, with campaign log and chaos bag carried between scenarios.
Ref: architecture §8. Builds on the campaign engine (M1C).

**Why this milestone**

- **Problem:** The Core Set is a three-scenario campaign: choices and outcomes in one scenario change the setup of the next, and the chaos bag evolves. Today this is tracked on paper and often gets lost or mis-recorded.
- **What the app gains:** The complete Core Set experience, and campaign infrastructure (log, resolutions, chaos bag carry-over) reused by every future campaign.
- **Why at this point:** The scenario pipeline and one real scenario (M4) are proven, so the remaining two scenarios should mostly be data.

---

## M5.1 Campaign model – moved to M1C

The campaign model, chaos bag, resolutions, campaign setup and storage are engine work and moved to `docs/tasks/M1C-campaign-engine.md`, so the play screen and the wizard are built with campaigns in mind. M5 keeps the campaign UI and the real scenarios.

## M5.2 Campaign UI (S)

**Why:** Between scenarios players need to see and confirm what happened; confirming resolutions keeps the app an assistant rather than a referee.

**Benefit:** Replaces the paper campaign log.

- [ ] New campaign flow in the wizard (investigators chosen once)
- [ ] Campaign screen: log, chaos bag, XP/trauma per investigator, next scenario button
- [ ] Resolution screen after a scenario: shows the steps for confirmation, then writes the log
- [ ] Picker opens only to replace killed/insane investigators

## M5.3 Scenario 2 (O)

**Why:** The second scenario validates the M4 recipe and campaign-dependent setup.

**Benefit:** More playable content; anything it shares with _Spreading Flames_ gets promoted to an engine primitive.

- [ ] Data via the M4 pipeline (layout, connections), definition, special mechanics, setup test
- [ ] Reads earlier log entries in `campaignSetup`

## M5.4 Scenario 3 (O)

**Why:** Completes the campaign, including how it ends.

**Benefit:** The whole Core Set campaign is playable in the app.

- [ ] Same as M5.3 for the final scenario, including campaign end

## M5.5 Campaign export/import and replay test (S)

**Why:** A campaign takes several evenings, so backups matter, and a cross-scenario replay is the strongest regression test we can have.

**Benefit:** Safe campaign backups, and one test that proves the whole campaign still works.

- [ ] Export/import a whole campaign (log + games)
- [ ] Golden replay across all three scenarios

Done when: the intro campaign can be played end to end with log and chaos bag carried over.
