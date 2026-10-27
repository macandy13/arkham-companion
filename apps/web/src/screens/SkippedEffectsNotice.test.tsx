// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { investigatorId, trait } from '@arkham/engine';
import { initI18n } from '../i18n';
import { SkippedEffectsNotice } from './SkippedEffectsNotice';

describe('SkippedEffectsNotice', () => {
  const roland = investigatorId('roland');
  beforeAll(() => initI18n('en'));
  afterEach(cleanup);

  it('names the card, the skipped effect and the missing card, and asks to do it by hand', () => {
    render(
      <SkippedEffectsNotice
        skipped={[
          {
            kind: 'missingCard',
            card: 'The Barrier',
            effect: 'SpawnEnemy',
            missing: ['Ghoul Priest'],
          },
        ]}
        onDismiss={() => {}}
      />,
    );

    expect(screen.getByRole('status', { name: 'Do this by hand' }).textContent).toContain(
      'The Barrier: spawning the enemy was skipped, as the game does not hold exactly one copy of Ghoul Priest. Please do it by hand.',
    );
  });

  it('falls back to a general text for an effect without its own', () => {
    render(
      <SkippedEffectsNotice
        skipped={[
          { kind: 'missingCard', card: 'The Barrier', effect: 'PlaceDoom', missing: ['Parlor'] },
        ]}
        onDismiss={() => {}}
      />,
    );

    expect(screen.getByRole('status').textContent).toContain('The Barrier: an effect was skipped');
  });

  it.each([
    {
      command: { type: 'DrawCards', investigatorId: roland, amount: 3 },
      text: 'Roland Banks: draw 3 cards. Please do it by hand.',
    },
    {
      command: {
        type: 'SearchDeck',
        investigatorId: roland,
        traits: [trait('Tome'), trait('Spell')],
        top: 6,
      },
      text: 'Roland Banks: search the top 6 cards of your deck for a card with the trait Tome or Spell, add it to your hand and shuffle your deck. Please do it by hand.',
    },
    {
      command: { type: 'DiscardFromHand', investigatorId: roland, amount: 4 },
      text: 'Roland Banks: choose and discard 4 cards from your hand. Please do it by hand.',
    },
  ] as const)('asks the players to do what the game left to them: $text', ({ command, text }) => {
    render(
      <SkippedEffectsNotice
        skipped={[{ kind: 'deferred', investigator: 'Roland Banks', command }]}
        onDismiss={() => {}}
      />,
    );

    expect(screen.getByRole('status').textContent).toContain(text);
  });

  it('is dismissed with OK', () => {
    const onDismiss = vi.fn();
    render(
      <SkippedEffectsNotice
        skipped={[
          {
            kind: 'missingCard',
            card: 'The Barrier',
            effect: 'SpawnEnemy',
            missing: ['Ghoul Priest'],
          },
        ]}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
