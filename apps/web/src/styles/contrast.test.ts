import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The colours text is set in reach a contrast of 4.5 against what they are printed on, enough for
 * text of any size (WCAG 2.1 AA, M6.5c), in every table skin and on the paper. An automated check
 * in the browser (`e2e/accessibility.spec.ts`) cannot measure these, since the table and the paper
 * are gradients and pictures, so this reads the colours from the tokens themselves.
 */
const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

/** The hex colours a rule of tokens.css sets, by name, its selector written as in the file. */
function colours(selector: string): Record<string, string> {
  const start = tokens.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No rule ${selector} in tokens.css`);
  const block = tokens.slice(start, tokens.indexOf('\n}', start));
  return Object.fromEntries(
    [...block.matchAll(/^\s*(--[\w-]+):\s*(#[0-9a-f]{6});/gim)].map(([, name, hex]) => [
      name!,
      hex!,
    ]),
  );
}

const root = colours(':root');
/** Each table skin's colours: the night and brass table is the root's, the others override it. */
const skins: Record<string, Record<string, string>> = {
  nightAndBrass: root,
  stars: { ...root, ...colours(":root[data-skin='stars']") },
  rlyeh: { ...root, ...colours(":root[data-skin='rlyeh']") },
  parchment: { ...root, ...colours(":root[data-theme='light']") },
};

/** The relative luminance of a `#rrggbb` colour (WCAG 2.1). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** The contrast ratio of two `#rrggbb` colours, from 1 to 21 (WCAG 2.1). */
function contrast(one: string, other: string): number {
  const [lighter, darker] = [luminance(one), luminance(other)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

describe('text contrast', () => {
  it.each(
    Object.keys(skins).flatMap((skin) =>
      [
        ['--color-text', '--color-background'],
        ['--color-text-muted', '--color-background'],
        ['--color-accent', '--color-background'],
        ['--color-text', '--color-menu'],
        ['--color-text-muted', '--color-menu'],
        ['--color-accent', '--color-menu'],
        ['--color-accent-text', '--color-accent'],
        ['--color-menu-danger', '--color-menu'],
      ].map(([text, ground]) => ({ skin, text: text!, ground: ground! })),
    ),
  )('on the $skin table, $text on $ground reaches 4.5', ({ skin, text, ground }) => {
    const colour = skins[skin]!;

    expect(contrast(colour[text]!, colour[ground]!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    '--color-ink',
    '--color-ink-muted',
    '--color-ink-accent',
    '--color-ink-clue',
    '--color-ink-doom',
    '--color-ink-health',
    '--color-ink-sanity',
  ])('on the paper, %s reaches 4.5', (ink) => {
    expect(contrast(root[ink]!, root['--color-paper']!)).toBeGreaterThanOrEqual(4.5);
  });

  it('on the paper, a primary pill’s paper text on the ink accent reaches 4.5', () => {
    expect(contrast(root['--color-paper']!, root['--color-ink-accent']!)).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});
