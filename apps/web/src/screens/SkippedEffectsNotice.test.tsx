// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { trait } from '@arkham/engine';
import { initI18n } from '../i18n';
import { SkippedEffectsNotice } from './SkippedEffectsNotice';

describe('SkippedEffectsNotice', () => {
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
      card: 'Southside',
      step: { kind: 'draw', amount: 3 },
      text: 'Roland Banks (Southside): draw 3 cards. Please do it by hand.',
    },
    {
      card: 'Miskatonic University',
      step: { kind: 'search', traits: [trait('Tome'), trait('Spell')], top: 6 },
      text: 'Roland Banks (Miskatonic University): search the top 6 cards of your deck for a card with the trait Tome or Spell, add it to your hand and shuffle your deck. Please do it by hand.',
    },
  ] as const)(
    'asks the investigator to do a step on their deck by hand: $text',
    ({ card, step, text }) => {
      render(
        <SkippedEffectsNotice
          skipped={[
            {
              kind: 'deckStep',
              card,
              investigator: 'Roland Banks',
              step,
            },
          ]}
          onDismiss={() => {}}
        />,
      );

      expect(screen.getByRole('status').textContent).toContain(text);
    },
  );

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
