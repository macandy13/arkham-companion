# Persistence

[`GameStore`](../../packages/engine/src/store.ts) is the only way to save or load a game:

- each game's event log plus snapshots,
- undo by `commandId`,
- and an `expectedSeq` check so two tabs cannot overwrite each other.

A campaign has its own event log in the same store (`createCampaign`, `appendCampaignEvents`, `loadCampaign`, `undoLastCampaign`, `listCampaigns`) with the same `commandId` undo groups and `expectedSeq` check, so a confirmed resolution is undone as one step.
Campaign logs stay short, so they are always replayed whole and have no snapshots.
A game links to its campaign through `NewGame.campaignId`; the [campaign log](campaign.md) records each played scenario and its outcome, not the game, so deleting a game leaves the campaign unchanged.

Beside its log, a game row keeps which step's notices the players dismissed (`ReadNotices`, `markNoticeRead`), so opening the game again doesn't show them twice. It names the step by `commandId`, since after an undo the next step reuses the `seq`; it is outside the log, so undo, export and import leave it alone.

Every command is written before the UI updates, so a refresh or flat battery loses nothing.
The log is also the export format.
[`IndexedDbStore`](../../apps/web/src/storage/IndexedDbStore.ts) implements it with Dexie; localStorage holds only device settings.

## Extension points

- **A new store operation:** a method on `GameStore` with its contract as doc comment, implemented and tested in `IndexedDbStore`.
- **A schema change:** bump the Dexie `version()` with an `upgrade`; a state shape change bumps `STATE_VERSION`.
