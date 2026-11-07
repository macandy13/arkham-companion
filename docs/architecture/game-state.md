# Game state

The whole table is one serialisable value, [`GameState`](../../packages/engine/src/state.ts).

- Every physical card is one `CardInstance` with a unique ID, its card code and exactly one [`Zone`](../../packages/engine/src/zone.ts), so moving a card anywhere is the same operation.
- The state stores codes, not card data; rules look stats up in the `CardDb`.
- Investigators are not card instances but seats with their own record.

Location connections come from the symbols the cards print, plus a graph on each [`GameMap`](../../packages/engine/src/map.ts) for those no card prints.

- [`printedConnections`](../../packages/engine/src/board.ts) derives an edge for each pair of locations in play where one's connection symbols (`CardStats.connectsTo`, on the side that is up) name the other's symbol, one-way when only one of them prints it (rules "Investigator actions against enemies", Move). They are derived on every call, never stored, so revealing a location or one entering or leaving play changes them with nothing to keep in sync.
- `GameMap.connections` holds the declared edges: card text such as the Main Path's "is connected to each other Woods location", and those effects add or remove (`AddConnection`, `RemoveConnection`). Such an edge counts once both its ends are in play, so a scenario may declare it for a location still set aside.
- `GameMap.cutConnections` holds the printed connections an effect cut ("is no longer connected to"): `RemoveConnection` removes a declared edge, and otherwise cuts a printed one on the map of its `from` location. A cut blocks the moves it allows while the symbols say otherwise (a two-way connection cut one way stays open the other, `uncutPrintedConnections`), since printed edges are derived and there is nothing else to remove.
- `openConnections` is both, printed first, without the declared edges the printed ones already allow; `neighbours`, `shortestPaths` (hunters, "nearest") and the map view all read it.
- Each map also keeps its book layout (`GameMap.layout`, cells on a grid three times finer than a card), which only the screen reads.
- A whole new map joins the board with `AddMap`; a single location joins a map already there with `PutLocationIntoPlay`, which sets its layout cell too (`LayoutCellSet`).

[`checkInvariants`](../../packages/engine/src/invariants.ts) states what must always hold; tests run it after every command.

```ts
interface GameState {
  meta: GameMeta;                        // scenario, round, phase, turn, lead, rng, queue, ended, …
  campaign?: CampaignLog;
  investigators: Investigator[];
  cards: Record<InstanceId, CardInstance>;
  order: Record<ZoneKey, InstanceId[]>;  // index 0 is the top of a deck
  board: Board;                          // maps with connections and layout
  chaosBag: ChaosToken[];
  chaosBagChanges: ChaosBagChange[];   // in-game bag changes that last for the campaign
  agenda: { current?: InstanceId }; act: { current?: InstanceId };
  scenario: unknown;                     // per-scenario state
  pending: Decision[];                   // open questions for the players
}
```

## Extension points

- **A new field:** add it in `state.ts`, give it a value in `emptyState()` and the reducer case that creates it, and an invariant if it can become inconsistent.
- **A new zone:** add a `Zone` kind with its `zoneKey` and its check in `validateZone` ([`placement.ts`](../../packages/engine/src/placement.ts)); if cards there count as in play, add it to `isInPlay` ([`doom.ts`](../../packages/engine/src/doom.ts)), which the compiler won't flag.
- **Moving cards or tokens:** use the shared event builders in `placement.ts` and [`investigators.ts`](../../packages/engine/src/investigators.ts), not hand-built events.
