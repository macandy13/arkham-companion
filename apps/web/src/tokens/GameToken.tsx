import type { HTMLAttributes, Ref } from 'react';
import './game_tokens.css';

/** The game's tokens that lie on the table and on cards, each with a face of its own (MD.8). */
export const GAME_TOKEN_KINDS = ['clue', 'doom', 'damage', 'horror', 'resource'] as const;
export type GameTokenKind = (typeof GAME_TOKEN_KINDS)[number];

/**
 * One of the game's tokens, drawn after the token on the table (MD.8a): its face comes from the
 * token set (`TokenSet`, `game_tokens.css`), the nearest `data-token-set` above it, the root's by
 * default. A `count` stands in a small disc at its lower edge rather than as a stack of tokens.
 * Without a `label` it is decoration (a dragged token, a preview) and hidden from assistive
 * technology. Other attributes (drag handlers, `data-*` hooks, a `ref`) pass through to its element.
 */
export function GameToken({
  kind,
  count,
  label,
  ...rest
}: {
  kind: GameTokenKind;
  count?: number;
  label?: string;
  ref?: Ref<HTMLSpanElement>;
} & Omit<HTMLAttributes<HTMLSpanElement>, 'role' | 'children'>) {
  const name = label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label };
  return (
    <span {...rest} {...name} data-game-token={kind}>
      {count !== undefined && <data value={count}>{count}</data>}
    </span>
  );
}
