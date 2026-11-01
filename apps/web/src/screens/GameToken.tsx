import { useId } from 'react';
import './game_token.css';

/**
 * The game tokens the app draws as on the table (design language, "Icons and tokens"; MD.8 adds
 * doom and the chaos tokens): clues, damage, horror and resources.
 */
export type GameTokenKind = 'clue' | 'damage' | 'horror' | 'resource';

/**
 * A game token in the resin dome finish the design language chose: a bronze bezel round a
 * watercolour field in the kind's colours (`data-game-token`, game_token.css), the kind's glyph in
 * one colour, and the `count` in a small disc on its lower half instead of a stack of tokens. Our
 * own drawing (no game art), in a 100-unit box. `label` names it for screen readers ("2 clues"),
 * since the glyph and the number alone do not say what they count.
 */
export function GameToken({
  kind,
  count,
  label,
}: {
  kind: GameTokenKind;
  count?: number | undefined;
  label: string;
}) {
  const id = useId();
  const field = `${id}field`;
  const bezel = `${id}bezel`;
  const dome = `${id}dome`;
  const gloss = `${id}gloss`;
  const clip = `${id}clip`;
  return (
    <span role="img" aria-label={label} data-game-token={kind}>
      <svg viewBox="-2 -2 104 106" aria-hidden="true">
        <defs>
          {/* The stylesheet colours the stops, by the token's kind and the bezel's bronze. */}
          <radialGradient id={field} cx="0.5" cy="0.42" r="0.6" data-part="field">
            <stop offset="0" />
            <stop offset="1" />
          </radialGradient>
          <linearGradient id={bezel} x1="0" y1="0" x2="1" y2="1" data-part="bezel">
            <stop offset="0" />
            <stop offset="0.35" />
            <stop offset="0.7" />
            <stop offset="1" />
          </linearGradient>
          <radialGradient id={dome} cx="0.5" cy="0.42" r="0.6" data-part="dome">
            <stop offset="0.7" />
            <stop offset="1" />
          </radialGradient>
          <linearGradient id={gloss} x1="0" y1="0" x2="0" y2="1" data-part="gloss">
            <stop offset="0" />
            <stop offset="1" />
          </linearGradient>
          <clipPath id={clip}>
            <circle cx="50" cy="50" r="44" />
          </clipPath>
        </defs>
        <circle data-part="shadow" cx="50" cy="53" r="49" />
        <circle cx="50" cy="50" r="49" fill={`url(#${bezel})`} />
        <circle data-part="setting" cx="50" cy="50" r="44.5" />
        <g clipPath={`url(#${clip})`}>
          <circle cx="50" cy="50" r="44" fill={`url(#${field})`} />
          <Glyph kind={kind} />
          {count !== undefined && (
            <g data-part="count">
              <circle cx="50" cy="68" r="21" />
              <text x="50" y="78.5" textAnchor="middle">
                {count}
              </text>
            </g>
          )}
          <circle cx="50" cy="50" r="44" fill={`url(#${dome})`} />
        </g>
        <ellipse
          data-part="shine"
          cx="38"
          cy="26"
          rx="24"
          ry="12"
          fill={`url(#${gloss})`}
          transform="rotate(-24 38 26)"
        />
        <path data-part="glint" d="M78 66a32 32 0 0 1-18 16" />
      </svg>
    </span>
  );
}

/**
 * The kind's glyph in the token's ink: a magnifier with tendrils for a clue, a cracked heart for
 * damage, a brain for horror and a crate for a resource.
 */
function Glyph({ kind }: { kind: GameTokenKind }) {
  switch (kind) {
    case 'clue':
      return (
        <g data-part="glyph">
          <circle cx="50" cy="36" r="18" data-part="lens" />
          <path d="M50 54V86" data-weight="heavy" />
          <path d="M43 66c-8-5-19-1-19 8 0 6 8 8 10 3 1-3-2-5-4-4" />
          <path d="M57 66c8-5 19-1 19 8 0 6-8 8-10 3-1-3 2-5 4-4" />
        </g>
      );
    case 'damage':
      return (
        <g data-part="glyph">
          <path d="M50 80C30 66 17 54 17 39 17 28 25 20 35 20 42 20 47 24 50 30 53 24 58 20 65 20 75 20 83 28 83 39 83 54 70 66 50 80Z" />
          <path d="M50 30 45 41 53 48 46 58 52 66 49 74" />
        </g>
      );
    case 'horror':
      return (
        <g data-part="glyph">
          <path d="M50 20C40 16 26 20 23 32 17 38 17 52 22 60 25 70 35 78 46 76L50 74 54 76C65 78 75 70 78 60 83 52 83 38 77 32 74 20 60 16 50 20Z" />
          <path d="M50 20V74" />
          <path d="M30 30c4 3 3 8 8 9s7-5 4-8M26 46c5-2 9 2 8 6s5 6 9 3M30 62c4-2 8 1 7 5M70 30c-4 3-3 8-8 9s-7-5-4-8M74 46c-5-2-9 2-8 6s-5 6-9 3M70 62c-4-2-8 1-7 5" />
        </g>
      );
    case 'resource':
      return (
        <g data-part="crate">
          <polygon points="50,26 72,37 50,48 28,37" data-side="top" />
          <polygon points="28,37 50,48 50,70 28,59" data-side="left" />
          <polygon points="50,48 72,37 72,59 50,70" data-side="right" />
          <path d="M31.3 41.4 46.7 66.7M31.3 57.2 46.7 50.2M53.3 50.2 68.7 57.2M53.3 66.7 68.7 41.4M39 31.5 61 42.5M39 42.5 61 31.5" />
        </g>
      );
  }
}
