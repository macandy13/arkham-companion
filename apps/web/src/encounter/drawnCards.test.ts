import { describe, expect, it } from 'vitest';
import {
  blankEnemy,
  blankLocation,
  blankTreachery,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  skillTest,
  whenRevealed,
  byName,
  type CardStats,
} from '@arkham/engine';
import { drawnCards } from './drawnCards';

const study = instanceId('study');
const alder = investigatorId('alder');

/** The events `step` adds to `table`'s log. */
const eventsOf = (table: PlayTable, step: () => void) => {
  const before = table.events.length;
  step();
  return table.events.slice(before);
};

describe('drawnCards', () => {
  /**
   * Alder in the Study; `top_card` (an enemy, or a treachery with `topCard`'s stats) lies on the
   * encounter deck, a plain treachery under it.
   */
  const aldersDraw = (topCard: Partial<CardStats>, enemy = false) =>
    PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withInvestigator(alder, { locationId: study })
        .withCard(
          instanceId('top_card'),
          enemy ? blankEnemy('top_card', topCard) : blankTreachery('top_card', topCard),
          { kind: 'encounterDeck' },
        )
        .withCard(instanceId('next_card'), blankTreachery('next_card'), {
          kind: 'encounterDeck',
        }),
    );

  it.each([
    { drawn: 'a treachery', enemy: false, place: { kind: 'encounterDiscard' } },
    { drawn: 'an enemy', enemy: true, place: { kind: 'engaged', investigator: alder } },
  ])('lists $drawn drawn for alder where it went', ({ enemy, place }) => {
    const table = aldersDraw({}, enemy);

    const events = eventsOf(table, () =>
      table.play({ type: 'DrawEncounter', investigatorId: alder }),
    );

    expect(drawnCards(table.board, events)).toEqual([
      { card: expect.objectContaining({ name: 'top_card' }), drawnFor: alder, place },
    ]);
  });

  it('leaves out a card still resolving, and lists it once its revelation test is answered', () => {
    const table = aldersDraw({ abilities: [whenRevealed(skillTest('willpower', 4))] });

    const drawing = eventsOf(table, () =>
      table.play({ type: 'DrawEncounter', investigatorId: alder }),
    );
    expect(drawnCards(table.board, drawing)).toEqual([]);

    const answering = eventsOf(table, () => table.answer(byName('top_card'), 'pass'));

    expect(drawnCards(table.board, answering)).toEqual([
      {
        card: expect.objectContaining({ name: 'top_card' }),
        place: { kind: 'encounterDiscard' },
      },
    ]);
  });
});
