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

/** What `step` does to `table`: the board before it, its events and the board after it. */
const stepOn = (table: PlayTable, step: () => void) => {
  const before = table.board;
  const logged = table.events.length;
  step();
  return { before, events: table.events.slice(logged), after: table.board };
};

describe('drawnCards', () => {
  /** Alder in the Study; `topCard` lies on the encounter deck, a plain treachery under it. */
  const aldersDraw = (topCard: CardStats) =>
    PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withInvestigator(alder, { locationId: study })
        .withCard(instanceId('top_card'), topCard, { kind: 'encounterDeck' })
        .withCard(instanceId('next_card'), blankTreachery('next_card'), {
          kind: 'encounterDeck',
        }),
    );

  it.each([
    { topCard: blankTreachery('top_card'), place: { kind: 'encounterDiscard' } },
    { topCard: blankEnemy('top_card'), place: { kind: 'engaged', investigator: alder } },
  ])('lists a $topCard.typeCode drawn for alder where it went', ({ topCard, place }) => {
    const table = aldersDraw(topCard);

    const { before, events, after } = stepOn(table, () =>
      table.play({ type: 'DrawEncounter', investigatorId: alder }),
    );

    expect(drawnCards(before, after, events)).toEqual([
      { card: expect.objectContaining({ name: 'top_card' }), drawnFor: alder, place },
    ]);
  });

  it('leaves out a card still resolving, and lists it for alder once its revelation test is answered', () => {
    const table = aldersDraw(
      blankTreachery('top_card', { abilities: [whenRevealed(skillTest('willpower', 4))] }),
    );

    const drawing = stepOn(table, () =>
      table.play({ type: 'DrawEncounter', investigatorId: alder }),
    );
    expect(drawnCards(drawing.before, drawing.after, drawing.events)).toEqual([]);

    const answering = stepOn(table, () => table.answer(byName('top_card'), 'pass'));

    expect(drawnCards(answering.before, answering.after, answering.events)).toEqual([
      {
        card: expect.objectContaining({ name: 'top_card' }),
        drawnFor: alder,
        place: { kind: 'encounterDiscard' },
      },
    ]);
  });
});
