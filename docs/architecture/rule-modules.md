# Rule modules

Generic rules are small modules per subject, called by the handlers:

- board ([`board.ts`](../../packages/engine/src/board.ts), [`placement.ts`](../../packages/engine/src/placement.ts)),
- doom and agenda ([`doom.ts`](../../packages/engine/src/doom.ts)),
- enemies ([`enemies.ts`](../../packages/engine/src/enemies.ts), [`spawn.ts`](../../packages/engine/src/spawn.ts), [`hunters.ts`](../../packages/engine/src/hunters.ts), [`forced_attacks.ts`](../../packages/engine/src/forced_attacks.ts)),
- investigators and elimination ([`investigators.ts`](../../packages/engine/src/investigators.ts), [`elimination.ts`](../../packages/engine/src/elimination.ts)),
- keywords ([`keywords.ts`](../../packages/engine/src/keywords.ts)).

Keyword details are read from their printed text where the rule needs them: A spawn instruction is read once, when the card data loads (`cardDbFrom` fills `CardStats.spawnAt` with `parseSpawn` from `spawn_instruction.ts`), into alternatives ("Your House. Otherwise, Rivertown."): "Engaged with prey", or a `Selector` among the locations in play, the same picked reference card effects use (`eachInPlay` with a trait, a name or list of names, `empty` or `connectedTo` your location; `best` for the most clues, or the nearest or farthest from the spawning investigator). `spawn.ts` tries them in turn with `candidatesOf`; a name that no location in the game has is text the engine can't read, which becomes a choice among all locations in play, never a guess. `prey.ts` reads a prey text as an extreme word (highest, most, lowest, fewest, least) and a measure (a counter, a skill with its lasting boost) or "nearest to another [[Trait]] enemy", or as whom it names: an investigator by name, those at a [[Trait]] location, or a weakness's bearer ("Bearer": `CardInstance.owner`); `preferredByPrey` keeps the tied investigators (with "only", among everyone, so possibly none; `preyAllows` limits hunters and engagement to them), and a prey it can't read (cards in hand, which the engine doesn't track) leaves all of them to the players with the `decision.choosePrey` prompt (`preyPrompt`).

The rules are summarised in [rules.md](../rules.md).

## Extension points

- **A new rule:** put it in its subject's module, and call it from its command's handler; it gets an end-to-end step only when it changes how a whole game plays ([coding guidelines](../coding-guidelines.md) §3).
