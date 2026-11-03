import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Point } from '../map/mapLayout';
import { DoomMark } from './DoomMark';

/**
 * The token a player drags (M3.11c), drawn over the whole page at the screen point `at`, so it
 * stays in sight when it leaves the map for an investigator's card. `kind` (`data-token-ghost`)
 * colours it like the token on the table. Hidden from assistive technology and from the pointer,
 * so the drop's hit test finds what lies under it.
 */
export function TokenGhost({ kind, at }: { kind: 'clue' | 'doom'; at: Point }) {
  const element = useRef<HTMLSpanElement>(null);
  // The position changes with every pointer move, so it goes to custom properties the stylesheet
  // places the token by, rather than into the markup.
  useLayoutEffect(() => {
    element.current?.style.setProperty('--ghost-x', `${at.x}px`);
    element.current?.style.setProperty('--ghost-y', `${at.y}px`);
  }, [at.x, at.y]);
  return createPortal(
    <span ref={element} aria-hidden="true" data-token-ghost={kind}>
      {kind === 'doom' && <DoomMark />}
    </span>,
    document.body,
  );
}
