# Game state

The whole table is one serialisable value, [`GameState`](../../packages/engine/src/state.ts).

- Every physical card is one `CardInstance` with a unique ID, its card code and exactly one [`Zone`](../../packages/engine/src/zone.ts), so moving a card anywhere is the same operation.
- The state stores codes, not card data; rules look stats up in the `CardDb`.
- Investigators are not card instances but seats with their own record.

Location connections are an explicit graph on each [`GameMap`](../../packages/engine/src/map.ts), since they change in play and can be one-way.

- A `revealedOnly` edge, printed on revealed sides only (the Arkham Woods to each other), counts in `neighbours` and shows on the map once both its locations are revealed.
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
  agenda: { current?: InstanceId }; act: { current?: InstanceId };
  scenario: unknown;                     // per-scenario state
  pending: Decision[];                   // open questions for the players
}
```

## Extension points

- **A new field:** add it in `state.ts`, give it a value in `emptyState()` and the reducer case that creates it, and an invariant if it can become inconsistent.
- **A new zone:** add a `Zone` kind with its `zoneKey` and its check in `validateZone` ([`placement.ts`](../../packages/engine/src/placement.ts)); if cards there count as in play, add it to `isInPlay` ([`doom.ts`](../../packages/engine/src/doom.ts)), which the compiler won't flag.
- **Moving cards or tokens:** use the shared event builders in `placement.ts` and [`investigators.ts`](../../packages/engine/src/investigators.ts), not hand-built events.
