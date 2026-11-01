// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initI18n } from '../i18n';
import { cardParagraphs, cardText } from './cardText';

/** `text` rendered by `cardText`: what it reads, with each icon as `{its name}`, and its emphasised runs. */
function rendered(text: string) {
  const { container } = render(<p>{cardText(text)}</p>);
  for (const icon of container.querySelectorAll('[role="img"]')) {
    icon.textContent = `{${icon.getAttribute('aria-label') ?? ''}}`;
  }
  return {
    reads: container.textContent,
    emphasised: Array.from(container.querySelectorAll('em'), (run) => run.textContent),
  };
}

// Hand-written card text in ArkhamDB markup, never a real card's.
describe('cardText', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it.each([
    {
      markup: 'a trait',
      text: 'Each [[Ghoul]] enemy moves.',
      reads: 'Each Ghoul enemy moves.',
      emphasised: ['Ghoul'],
    },
    {
      markup: 'a bold run',
      text: '<b>Forced</b> – Discard it.',
      reads: 'Forced – Discard it.',
      emphasised: ['Forced'],
    },
    {
      markup: 'an italic run',
      text: 'Draw 1 card. <i>(Once per game.)</i>',
      reads: 'Draw 1 card. (Once per game.)',
      emphasised: ['(Once per game.)'],
    },
    {
      markup: 'a bold run naming a trait and a symbol',
      text: '<b>[[Tome]]. [action]:</b> Draw 1 card.',
      reads: 'Tome. {Action}: Draw 1 card.',
      emphasised: ['Tome. {Action}:', 'Tome'],
    },
    {
      markup: 'a bracket word that is no symbol',
      text: '[constructor] stays.',
      reads: '[constructor] stays.',
      emphasised: [],
    },
    {
      markup: 'symbols',
      text: '[reaction] Gain 1 resource. [elder_sign] effect: +1.',
      reads: '{Reaction} Gain 1 resource. {Elder Sign} effect: +1.',
      emphasised: [],
    },
    {
      markup: '[fast], which the cards print as the free symbol',
      text: '[fast] Spend 1 clue.',
      reads: '{Free} Spend 1 clue.',
      emphasised: [],
    },
    {
      markup: 'a symbol without an icon',
      text: '[frost] stays.',
      reads: '[frost] stays.',
      emphasised: [],
    },
    {
      markup: 'an underline, which it drops',
      text: 'Every <u>i</u> dotted.',
      reads: 'Every i dotted.',
      emphasised: [],
    },
  ])('reads $markup', ({ text, reads, emphasised }) => {
    expect(rendered(text)).toEqual({ reads, emphasised });
  });

  it('shows a tag left over once others are dropped as text, never as an element', () => {
    const { container } = render(<div>{cardText('<scr<u>ipt>alert(1)</script>')}</div>);

    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toBe('<script>alert(1)');
  });

  it('sets each line of card text as a paragraph of its own, skipping empty ones', () => {
    const { container } = render(<div>{cardParagraphs('First ability.\n\nSecond ability.')}</div>);

    expect(Array.from(container.querySelectorAll('p'), (line) => line.textContent)).toEqual([
      'First ability.',
      'Second ability.',
    ]);
  });
});
