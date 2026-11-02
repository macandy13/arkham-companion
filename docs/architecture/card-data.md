# Card data

The engine reads card stats only through a [`CardDb`](../../packages/engine/src/cards.ts) in its context (`ctx.cards.get(code)` → `CardStats`), so tests pass a small fake.

- [`@arkham/carddata`](../../packages/carddata/src/) fetches ArkhamDB packs, validates them with zod and normalises them to `CardDef`; it does not depend on the engine.
- Every pack carries its rules chapter (1 or 2).
- Fetched JSON and images go to `packages/carddata/.cache/` or IndexedDB, never into git.
- The app refreshes its copy with `If-Modified-Since` ([`loadCatalog.ts`](../../apps/web/src/catalog/loadCatalog.ts)) and works offline. A cached copy whose `format` is older than `CATALOG_FORMAT` is fetched in full once, so new catalog data reaches every player; raise `CATALOG_FORMAT` with each such addition.
- The app's catalog (`CardCatalog`) holds the investigators for the picker, with the traits, ability and flavour texts their card prints (ArkhamDB markup, for the investigator card's notebook page), and the printed texts of the scenario reference cards ([`references.ts`](../../packages/carddata/src/references.ts): by card code, front for Easy / Standard and back for Hard / Expert, one text per symbol token in ArkhamDB markup) and the pictures of their sides (`referencePictures`, for the card pictures theme), so the scenario card shows them in the data's language without card text in git. A scenario names its card with `ScenarioDefinition.referenceCode`; the engine keeps only each row's modifier.

## Extension points

- **A new card field:** read it in `RawCardSchema`, normalise it in [`schema.ts`](../../packages/carddata/src/schema.ts), and add it to `CardStats` only if a rule or view needs it.
- **A new language:** its ArkhamDB host in `fetch.ts` and `loadCatalog.ts`, and UI strings in [`i18n`](../../apps/web/src/i18n/).
