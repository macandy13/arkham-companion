# Card data

The engine reads card stats only through a [`CardDb`](../../packages/engine/src/cards.ts) in its context (`ctx.cards.get(code)` → `CardStats`), so tests pass a small fake.

- [`@arkham/carddata`](../../packages/carddata/src/) fetches ArkhamDB packs, validates them with zod and normalises them to `CardDef`; it does not depend on the engine.
- Every pack carries its rules chapter (1 or 2).
- Fetched JSON and images go to `packages/carddata/.cache/` or IndexedDB, never into git.
- The app refreshes its copy with `If-Modified-Since` ([`loadCatalog.ts`](../../apps/web/src/catalog/loadCatalog.ts)) and works offline. A cached copy whose `format` is older than `CATALOG_FORMAT` is fetched in full once, so new catalog data reaches every player; raise `CATALOG_FORMAT` with each such addition.
- The app's catalog (`CardCatalog`) holds the investigators for the picker, with the traits, ability and flavour texts their card prints (ArkhamDB markup, for the notebook page of the whole investigator card opened from the play screen), and the printed texts of the scenario reference cards ([`references.ts`](../../packages/carddata/src/references.ts): by card code, front for Easy / Standard and back for Hard / Expert, one text per symbol token in ArkhamDB markup) and the pictures of their sides (`referencePictures`, for the card pictures theme), so the scenario card shows them in the data's language without card text in git. A scenario names its card with `ScenarioDefinition.referenceCode`; the engine keeps only each row's modifier.

- [`campaign_guides.ts`](../../packages/carddata/src/campaign_guides.ts) reads the ArkhamCards campaign guides ([zzorba/arkham-cards-data](https://github.com/zzorba/arkham-cards-data)) for what ArkhamDB lacks. `pnpm carddata:campaign <campaign>` ([`campaign_guides_fetch.ts`](../../packages/carddata/src/campaign_guides_fetch.ts)) keeps a shallow git clone in `.cache/` (the repo has no licence, so nothing of it is committed; the file names aren't the scenario ids, so single files over HTTP won't do) and prints a report per scenario for its author:
  - each `location_setup` step as `LayoutSlot`s: a card by code and side, or a named slot (`location_names`) where the guide shows no single card; positions are in card steps, so the guide's half spacing gives fractions and the engine's `GridCell` is a position times `GRID_CELLS_PER_CARD`;
  - what is left to do by hand: scenarios without a layout, named slots without a label, diagram parts not read (arrows, annotations) and spacings it doesn't know (`tight`, read as a full step).
  - from [`campaign_setup.ts`](../../packages/carddata/src/campaign_setup.ts): the campaign's starting bag per difficulty (its difficulty choice; a Return to box has none and plays with its original's), and per scenario the encounter sets its setup gathers or sets aside and the chaos tokens a setup step adds or removes outright, token names as the engine writes them (`elderThing`);
  - the setup steps left to the author: those written only as text (most set-aside cards), those that depend on the log or the players (`branch`) and the players' choices (`input`). Steps the app shares between scenarios (`$play_scenario`) are not the scenario's.

## Extension points

- **A new card field:** read it in `RawCardSchema`, normalise it in [`schema.ts`](../../packages/carddata/src/schema.ts), and add it to `CardStats` only if a rule or view needs it.
- **More from the campaign guides:** a zod schema for the step or effect type in `campaign_guides.ts` or `campaign_setup.ts`, and its own lines in the report.
- **A new language:** its ArkhamDB host in `fetch.ts` and `loadCatalog.ts`, and UI strings in [`i18n`](../../apps/web/src/i18n/).
