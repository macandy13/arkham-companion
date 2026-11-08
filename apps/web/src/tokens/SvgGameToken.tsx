import type { Point } from '../map/mapLayout';
import { TOKEN_SETS, type TokenSet } from '../settings/settings';
import type { GameTokenKind } from './GameToken';
import './game_tokens.css';

/**
 * The plain faces (MD.8a) by set and kind, as asset URLs: a drawing has no `::before` to take a
 * face from the stylesheet, so it names the files itself.
 */
const PLAIN_FACES = import.meta.glob<string>('./*/*_plain.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

function plainFace(set: TokenSet, kind: GameTokenKind): string {
  const face = PLAIN_FACES[`./${set}/${kind}_plain.svg`];
  if (face === undefined) throw new Error(`No ${set} face for the ${kind} token`);
  return face;
}

/**
 * How far the count disc's centre lies from the token's, as a share of its radius, along the
 * diagonal to its lower right: on the rim, like the HTML token's disc over its edge.
 */
const COUNT_REACH = 0.75 * Math.SQRT1_2;

/**
 * One of the game's tokens inside a drawing (MD.8b): the map's tokens on a location or beside an
 * enemy, a count on a card face. The SVG twin of `GameToken`, with its `count` in a small disc at
 * its lower right. Small on the map, so it takes the plain face (MD.8a: below 32 px), one per set,
 * and the stylesheet shows the one of the nearest `data-token-set` (`game_tokens.css`), so a
 * drawing follows the setting without knowing it. Carries no name: the group it is drawn in says
 * what it counts.
 */
export function SvgGameToken({
  kind,
  centre: { x, y },
  radius,
  count,
  countRadius = radius / 2,
}: {
  kind: GameTokenKind;
  centre: Point;
  radius: number;
  count?: number;
  /** The count disc's radius, larger where the token is too small for a readable number. */
  countRadius?: number;
}) {
  const disc = { x: x + radius * COUNT_REACH, y: y + radius * COUNT_REACH };
  return (
    <g data-svg-game-token={kind}>
      {TOKEN_SETS.map((set) => (
        <image
          key={set}
          data-token-face={set}
          href={plainFace(set, kind)}
          x={x - radius}
          y={y - radius}
          width={2 * radius}
          height={2 * radius}
        />
      ))}
      {count !== undefined && (
        <g data-part="count">
          <circle cx={disc.x} cy={disc.y} r={countRadius} />
          <text x={disc.x} y={disc.y}>
            {count}
          </text>
        </g>
      )}
    </g>
  );
}
