import { describe, expect, it } from 'vitest';
import {
  atLocation,
  attachedTo,
  blankEnemy,
  blankLocation,
  blankTreachery,
  effectiveValue,
  engagedWith,
  instanceId,
  investigatorId,
  newGame,
  setAside,
  type CardModifier,
  type ModifiedStat,
} from './index';
import { requireCard } from './lookup';
import { stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const study = instanceId('study');
const hall = instanceId('hall');
const ghoul = instanceId('ghoul');
const fog = instanceId('fog');

/** A ghoul with fight 3 and evade 2. */
const ghoulCard = blankEnemy('ghoul', { fight: 3, evade: 2 });
/** A treachery that gives the card it is attached to +2 shroud. */
const fogCard = blankTreachery('fog', { modifiers: [{ stat: 'shroud', of: 'host', by: 2 }] });
/** A location with shroud 1 whose enemies get +1 fight. */
const diningHallCard = blankLocation('dining_hall', {
  shroud: 1,
  modifiers: [{ stat: 'fight', of: 'enemiesHere', by: 1 }],
});

/** Alice in the study (shroud 3), next to the hall (shroud 1). */
const aliceInStudy = newGame()
  .withLocation(study, blankLocation('study', { shroud: 3 }), { revealed: true })
  .withLocation(hall, blankLocation('hall', { shroud: 1 }), { revealed: true })
  .withConnection(study, hall)
  .withInvestigator(alice, { locationId: study });

describe('effectiveValue', () => {
  it.each<{ name: string; stat: ModifiedStat; value: number }>([
    { name: 'shroud', stat: 'shroud', value: 3 },
    { name: 'fight, which the study does not print', stat: 'fight', value: 0 },
  ])('is the printed $name without constant abilities', ({ stat, value }) => {
    const { context, state } = aliceInStudy.start();

    expect(effectiveValue(context, state, requireCard(state.cards, study), stat)).toBe(value);
  });

  it.each([
    { name: 'attached to the study', zone: attachedTo(study), shroud: 5 },
    { name: 'attached to the hall', zone: attachedTo(hall), shroud: 3 },
    { name: 'set aside', zone: setAside, shroud: 3 },
  ])('adds the shroud of a card that names its host while $name', ({ zone, shroud }) => {
    const { context, state } = aliceInStudy.withCard(fog, fogCard, zone).start();

    expect(effectiveValue(context, state, requireCard(state.cards, study), 'shroud')).toBe(shroud);
  });

  it.each([
    {
      name: 'unengaged at the revealed dining hall',
      zone: atLocation(study),
      revealed: true,
      fight: 4,
    },
    {
      name: 'engaged with alice at the dining hall',
      zone: engagedWith(alice),
      revealed: true,
      fight: 4,
    },
    { name: 'at the hall', zone: atLocation(hall), revealed: true, fight: 3 },
    { name: 'at the unrevealed dining hall', zone: atLocation(study), revealed: false, fight: 3 },
  ])('gives an enemy $name the fight its location adds', ({ zone, revealed, fight }) => {
    const { context, state } = newGame()
      .withLocation(study, diningHallCard, { revealed })
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: study })
      .withCard(ghoul, ghoulCard, zone)
      .start();

    expect(effectiveValue(context, state, requireCard(state.cards, ghoul), 'fight')).toBe(fight);
  });

  it('adds what a card gives itself, only to the stat it names', () => {
    const toughGhoul: CardModifier = { stat: 'evade', of: 'self', by: 2 };
    const { context, state } = aliceInStudy
      .withCard(
        ghoul,
        blankEnemy('tough_ghoul', { fight: 3, evade: 2, modifiers: [toughGhoul] }),
        atLocation(study),
      )
      .start();
    const card = requireCard(state.cards, ghoul);

    expect([
      effectiveValue(context, state, card, 'fight'),
      effectiveValue(context, state, card, 'evade'),
    ]).toEqual([3, 4]);
  });
});

describe('tests against effective values', () => {
  it('raises a fight against the fight its location adds', () => {
    const { context, state } = newGame()
      .withLocation(study, diningHallCard, { revealed: true })
      .withInvestigator(alice, { locationId: study })
      .withCard(ghoul, ghoulCard, engagedWith(alice))
      .start();

    const after = stateAfter(context, state, {
      type: 'Fight',
      investigatorId: alice,
      enemyId: ghoul,
    });

    expect(after.pending[0]?.skillTest).toEqual({ skill: 'combat', difficulty: 4 });
  });
});
