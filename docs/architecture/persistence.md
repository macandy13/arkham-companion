# Persistence

[`GameStore`](../../packages/engine/src/store.ts) is the only way to save or load a game:

- each game's event log plus snapshots,
- undo by `commandId`,
- and an `expectedSeq` check so two tabs cannot overwrite each other.

Every command is written before the UI updates, so a refresh or flat battery loses nothing.
The log is also the export format.
[`IndexedDbStore`](../../apps/web/src/storage/IndexedDbStore.ts) implements it with Dexie; localStorage holds only device settings.

## Extension points

- **A new store operation:** a method on `GameStore` with its contract as doc comment, implemented and tested in `IndexedDbStore`.
- **A schema change:** bump the Dexie `version()` with an `upgrade`; a state shape change bumps `STATE_VERSION`.
