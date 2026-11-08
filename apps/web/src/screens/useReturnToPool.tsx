import type { ReactNode } from 'react';
import { overTokenPool } from './headerDropTarget';
import type { GameTokenKind } from '../tokens/GameToken';
import { TokenGhost } from './TokenGhost';
import { useTokenDrag, type TokenDragHandlers } from './useTokenDrag';

/**
 * Dragging a `kind` token off a count back to the header's token pool (M3.11c): `handlers` for the
 * count and `shown`, the token under the finger (`TokenGhost`). A drop on the pool
 * (`overTokenPool`) calls `onReturn`, which heals or spends it; a drop anywhere else leaves it.
 */
export function useReturnToPool(
  kind: GameTokenKind,
  onReturn: () => void,
): { handlers: TokenDragHandlers; shown: ReactNode } {
  const drag = useTokenDrag((client) => {
    if (overTokenPool(client)) onReturn();
  });
  return {
    handlers: drag.handlers,
    shown: drag.at && <TokenGhost kind={kind} at={drag.at} />,
  };
}
