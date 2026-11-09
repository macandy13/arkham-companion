# Persistence

[`GameStore`](../../packages/engine/src/store.ts) is the only way to save or load a game:

- each game's event log plus snapshots,
- undo by `commandId`,
- and an `expectedSeq` check so two tabs cannot overwrite each other.

A campaign has its own event log in the same store (`createCampaign`, `appendCampaignEvents`, `loadCampaign`, `undoLastCampaign`, `listCampaigns`, `renameCampaign`, `deleteCampaign`) with the same `commandId` undo groups and `expectedSeq` check, so a confirmed resolution is undone as one step.
Campaign logs stay short, so they are always replayed whole and have no snapshots.
An event the game or a resolution wrote by itself keeps its cause (`StoredEvent.cause`, `StoredCampaignEvent.cause`, from the engine's [change causes](command-handling.md)), passed to `appendEvents`/`appendCampaignEvents` beside the events; the players' own events have none. Replay never reads it: it is there so the log can say why, after a reload too. Export and import carry it.
A game links to its campaign through `NewGame.campaignId`; the [campaign log](campaign.md) records each played scenario and its outcome, not the game, so deleting a game leaves the campaign unchanged. Deleting a campaign goes the other way: its games can't go on without it, so `deleteCampaign` removes them with it, in one transaction.

A game row and a campaign row also keep how much the players rely on the helpers ([`Reliance`](../../packages/engine/src/reliance.ts): `display`, `assist` or `auto`; `createGame`/`createCampaign`, `setGameReliance`/`setCampaignReliance`), absent until chosen and read as `DEFAULT_RELIANCE`. It is a setting rather than play, so it lives on the row, not in the log: changing it is no step to undo and leaves `updatedAt` alone. A game of a campaign follows the campaign's level, which the caller reads; the store doesn't resolve it. A duplicate keeps it; export and import don't carry it. `showsNotice` says which notice kinds (`NoticeKind`) each level shows.

Beside its log, a game row keeps which step's notices the players dismissed (`ReadNotices`, `markNoticeRead`), so opening the game again doesn't show them twice. It names the step by `commandId` and `undoLast` forgets the undone step's marks, because the next step reuses the undone step's `seq` and, after a reload, its id. It is outside the log: a duplicate keeps it, export and import don't carry it.

Every command is written before the UI updates, so a refresh or flat battery loses nothing.
The log is also the export format: a game's file ([`gameExport`](../../apps/web/src/storage/gameExport.ts)) holds its log, a campaign's ([`campaignExport`](../../apps/web/src/storage/campaignExport.ts)) its log and its games' logs, and home loads either through one button (`parseExportFile`, told apart by `format`). Both modules validate with zod, so the store imports them only when a file is exported or imported; the error an import throws ([`importError`](../../apps/web/src/storage/importError.ts)) lives apart, so home can word it without loading them. An import gets new ids; a campaign's logs name their campaign (`CampaignStarted`, and the copy of the log in each game's `ScenarioStarted`), so `importCampaign` moves them to the new id (`campaign.moveCampaignEvent`, `campaign.moveGameEvent`).
[`IndexedDbStore`](../../apps/web/src/storage/IndexedDbStore.ts) implements it with Dexie; localStorage holds only device settings.

## Extension points

- **A new store operation:** a method on `GameStore` with its contract as doc comment, implemented and tested in `IndexedDbStore`.
- **A schema change:** bump the Dexie `version()` with an `upgrade`; a state shape change bumps `STATE_VERSION`.
