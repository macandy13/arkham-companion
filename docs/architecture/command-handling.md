# Command handling

[`handle`](../../packages/engine/src/handle.ts) turns one command into the complete list of events it causes; [`apply`](../../packages/engine/src/reducer.ts) folds an event into the state. All logic lives in `handle`: `apply` never validates, generates IDs or draws random numbers, so replaying a log needs neither card data nor the RNG.

```ts
function handle(ctx: EngineContext, state: GameState, command: Command): Event[];  // throws CommandRejected
function apply(state: GameState, event: Event): GameState;
interface EngineContext { cards: CardDb; scenario?: ScenarioDefinition; }  // code and lookup data, never saved
```

Inside one call a command resolves as a queue of steps, depth first: the command's own events, then the forced effects its events trigger (see [Triggers and card effects](triggers-and-card-effects.md)), then its continuations (an agenda's reverse side before the next agenda; a drawn card's revelation before its placement; surge). A step that raises a decision stops the queue and stores the rest in `GameMeta.queue`; the answer resumes it. An action that provokes attacks of opportunity is held until those are answered. A refused follow-up refuses the whole command, and so does a trigger loop, so bad card data cannot hang the app or leave half an effect behind.

Every command type has one entry in [`COMMAND_SPECS`](../../packages/engine/src/command_specs.ts): its handler (in a `handle_<area>.ts` file or a rule module) plus its policies (fires no triggers, allowed while a decision is pending or after the end, provokes, continues). Once the scenario has ended, only `ManualAdjust` is allowed. Handlers never import each other; shared queries live with their entity. All events of one player command share a `commandId`, so [undo](../../packages/engine/src/undo.ts) removes a command with its whole chain.

## Extension points

- **A new command:** add it to the `Command` union in [`commands.ts`](../../packages/engine/src/commands.ts), its handler in a `handle_<area>.ts` and its `COMMAND_SPECS` entry. An action command extends `ActionCommand`, and its spec uses `provokes: asAction`.
- **A new event:** reuse one if you can; otherwise add it in [`events.ts`](../../packages/engine/src/events.ts) with a non-validating case in `apply`.
- **A new refusal:** add a `RejectionCode` in [`rejection.ts`](../../packages/engine/src/rejection.ts).
