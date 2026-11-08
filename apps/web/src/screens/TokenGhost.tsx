import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Point } from '../map/mapLayout';
import { GameToken, type GameTokenKind } from '../tokens/GameToken';

/**
 * The token a player drags (M3.11c), drawn over the whole page at the screen point `at`, so it
 * stays in sight when it leaves the map for an investigator's card, drawn like the token on the
 * table (`GameToken`); `data-token-ghost` places it. Hidden from assistive technology and from the pointer,
 * so the drop's hit test finds what lies under it.
 */
export function TokenGhost({ kind, at }: { kind: GameTokenKind; at: Point }) {
  const element = useRef<HTMLSpanElement>(null);
  // The position changes with every pointer move, so it goes to custom properties the stylesheet
  // places the token by, rather than into the markup.
  useLayoutEffect(() => {
    element.current?.style.setProperty('--ghost-x', `${at.x}px`);
    element.current?.style.setProperty('--ghost-y', `${at.y}px`);
  }, [at.x, at.y]);
  return createPortal(
    <GameToken ref={element} kind={kind} data-token-ghost={kind} />,
    document.body,
  );
}
