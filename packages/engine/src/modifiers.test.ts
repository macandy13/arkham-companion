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
  modifiersOn,
  newGame,
  setAside,
  threatAreaOf,
  type CardValue,
} from './index';
import { requireCard } from './lookup';

const alice = investigatorId('alice');
const study = instanceId('study');
const hall = instanceId('hall');
const ghoul = instanceId('ghoul');
const fog = instanceId('fog');
const diningHall = instanceId('dining_hall');

/** A ghoul with fight 3 and evade 2. */
const ghoulCard = blankEnemy('ghoul', { fight: 3, evade: 2 });
/** A treachery that gives the card it is attached to +2 shroud. */
const fogCard = blankTreachery('fog', { modifiers: [{ value: 'shroud', of: 'host', by: 2 }] });
/** A location with shroud 1 whose enemies get +1 fight. */
const diningHallCard = blankLocation('dining_hall', {
  shroud: 1,
  modifiers: [{ value: 'fight', of: 'enemiesHere', by: 1 }],
});

/** Alice in the study (shroud 3), next to the hall (shroud 1). */
const aliceInStudy = newGame()
  .withLocation(study, blankLocation('study', { shroud: 3 }), { revealed: true })
  .withLocation(hall, blankLocation('hall', { shroud: 1 }), { revealed: true })
  .withConnection(study, hall)
  .withInvestigator(alice, { locationId: study });

describe('effectiveValue', () => {
  it.each<{ name: string; stat: CardValue; value: number }>([
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

  it('never goes below 0, e.g. -5 shroud on the study (shroud 3)', () => {
    const clearing = blankTreachery('clearing', {
      modifiers: [{ value: 'shroud', of: 'host', by: -5 }],
    });
    const { context, state } = aliceInStudy.withCard(fog, clearing, attachedTo(study)).start();

    expect(effectiveValue(context, state, requireCard(state.cards, study), 'shroud')).toBe(0);
  });

  it.each([
    {
      name: 'unengaged at the revealed dining hall',
      zone: atLocation(diningHall),
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
    {
      name: 'at the unrevealed dining hall',
      zone: atLocation(diningHall),
      revealed: false,
      fight: 3,
    },
  ])('gives an enemy $name the fight its location adds', ({ zone, revealed, fight }) => {
    const { context, state } = newGame()
      .withLocation(diningHall, diningHallCard, { revealed })
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: diningHall })
      .withCard(ghoul, ghoulCard, zone)
      .start();

    expect(effectiveValue(context, state, requireCard(state.cards, ghoul), 'fight')).toBe(fight);
  });
});

describe('effectiveValue with a modifier of the card itself', () => {
  it('adds the shroud a revealed location gives itself: 2 + 1', () => {
    const gloomyCard = blankLocation('gloomy', {
      shroud: 2,
      modifiers: [{ value: 'shroud', of: 'self', by: 1 }],
    });
    const gloomy = instanceId('gloomy');
    const { context, state } = newGame()
      .withLocation(gloomy, gloomyCard, { revealed: true })
      .withInvestigator(alice, { locationId: gloomy })
      .start();

    expect(effectiveValue(context, state, requireCard(state.cards, gloomy), 'shroud')).toBe(3);
  });
});

describe('modifiersOn', () => {
  /** A treachery that makes each move of the investigator it threatens cost 1 more. */
  const heavyCard = blankTreachery('heavy', {
    modifiers: [{ value: 'actionCost', of: 'threatArea', actions: ['move'], by: 1 }],
  });
  const heavy = instanceId('heavy');

  it('names the card whose modifier changes the study: the fog attached to it', () => {
    const { context, state } = aliceInStudy.withCard(fog, fogCard, attachedTo(study)).start();

    const active = modifiersOn(context, state, {
      kind: 'card',
      card: requireCard(state.cards, study),
    });

    expect(active).toEqual([
      { source: requireCard(state.cards, fog), modifier: { value: 'shroud', of: 'host', by: 2 } },
    ]);
  });

  it("gives alice the action cost of the treachery in her threat area, not the study's", () => {
    const { context, state } = aliceInStudy.withCard(heavy, heavyCard, threatAreaOf(alice)).start();

    expect(modifiersOn(context, state, { kind: 'investigator', investigatorId: alice })).toEqual([
      {
        source: requireCard(state.cards, heavy),
        modifier: { value: 'actionCost', of: 'threatArea', actions: ['move'], by: 1 },
      },
    ]);
    expect(
      modifiersOn(context, state, { kind: 'card', card: requireCard(state.cards, study) }),
    ).toEqual([]);
  });
});
