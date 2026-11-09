import { useState } from 'react';
import { signed } from '../tokens/tokenValue';

/** The last change of a shown count (`useCountChange`): by how much, and a key new to each change. */
export interface CountChange {
  readonly delta: number;
  readonly key: number;
}

/**
 * The last time `count` changed while shown (M3.13b), so the counter can play an effect for it:
 * the element keyed by `change.key`, which restarts its animation, and marked with
 * `deltaText(change)`. None until it changes, so opening a game or a dialog plays nothing.
 */
export function useCountChange(count: number): CountChange | undefined {
  const [last, setLast] = useState<{ count: number; change?: CountChange }>({ count });
  // Worked out while rendering rather than in an effect, so the effect starts with the new count.
  if (count !== last.count) {
    const change = { delta: count - last.count, key: (last.change?.key ?? 0) + 1 };
    setLast({ count, change });
    return change;
  }
  return last.change;
}

/**
 * How a change reads on its counter ("+1", "−2", as the players say a modifier: `signed`), for its
 * `data-delta`, which the stylesheet lets rise from the counter.
 */
export function deltaText(change: CountChange | undefined): string | undefined {
  return change && signed(change.delta);
}
