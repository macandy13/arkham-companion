# Rule modules

Generic rules are small modules per subject, called by the handlers: board ([`board.ts`](../../packages/engine/src/board.ts), [`placement.ts`](../../packages/engine/src/placement.ts)), doom and agenda ([`doom.ts`](../../packages/engine/src/doom.ts)), enemies ([`enemies.ts`](../../packages/engine/src/enemies.ts), [`spawn.ts`](../../packages/engine/src/spawn.ts), [`hunters.ts`](../../packages/engine/src/hunters.ts), [`forced_attacks.ts`](../../packages/engine/src/forced_attacks.ts)), investigators and elimination ([`investigators.ts`](../../packages/engine/src/investigators.ts), [`elimination.ts`](../../packages/engine/src/elimination.ts)), keywords ([`keywords.ts`](../../packages/engine/src/keywords.ts)). The rules are summarised in [rules.md](../rules.md).

## Extension points

- **A new rule:** put it in its subject's module, call it from its command's handler, and show it in the end-to-end test.
