# Per-investigator values

[Per investigator](https://arkhamdb.com/rules#Per_Investigator): the value is multiplied by the number of investigators **who started the scenario**.

- Eliminated investigators still count.
  Test: [`packages/engine/src/timing.test.ts › a per-investigator threshold after an investigator is eliminated › still counts the defeated investigator`](../../packages/engine/src/timing.test.ts#L445)
  Test: [`packages/engine/src/doom.test.ts › Advance the act › keeps the starting player count after bob is defeated, so alice alone cannot pay`](../../packages/engine/src/doom.test.ts#L631)
- The product is treated as the printed value, so it is applied before any other modifier.
