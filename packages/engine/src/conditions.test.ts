import { describe, expect, it } from 'vitest';
import {
  atLocation,
  blankAgenda,
  blankEnemy,
  blankLocation,
  blankTreachery,
  cardCode,
  duringAgenda,
  eachEnemy,
  eachEnemyAt,
  eachInvestigatorAt,
  encounterDeck,
  engagedWith,
  fixed,
  ifThereAre,
  instanceId,
  investigatorId,
  newGame,
  onlyCopy,
  takeHorror,
  whenRevealed,
  type Command,
} from './index';
import { investigatorOf, stateAfter } from '../test/utils';

const hall = instanceId('hall');
const study = instanceId('study');
const omen = instanceId('omen');
const ghoul = instanceId('ghoul');
const alice = investigatorId('alice');
const bob = investigatorId('bob');
const aliceDraws: Command = { type: 'DrawEncounter', investigatorId: alice };

describe('a condition on the enemies at your location', () => {
  /** "Revelation – If there is an enemy at your location, take 1 horror." */
  const omenCard = blankTreachery('omen', {
    abilities: [
      ifThereAre(eachEnemyAt({ ref: 'windowLocation' }), { min: 1 }, whenRevealed(takeHorror(1))),
    ],
  });

  it.each([
    { ghoulIs: 'in the hall with alice', zone: atLocation(hall), horror: 1 },
    { ghoulIs: 'engaged with alice', zone: engagedWith(alice), horror: 1 },
    { ghoulIs: 'in the study', zone: atLocation(study), horror: 0 },
  ])('gives alice $horror horror while the ghoul is $ghoulIs', ({ zone, horror }) => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(study, blankLocation('study'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(ghoul, blankEnemy('ghoul'), zone)
      .withCard(omen, omenCard, encounterDeck)
      .start();

    const after = stateAfter(context, state, aliceDraws);

    expect(investigatorOf(after, alice).sanity.horror).toBe(horror);
  });
});

describe('a condition on the enemies engaged with you', () => {
  /** "Revelation – If no enemy is engaged with you, take 1 horror." */
  const omenCard = blankTreachery('omen', {
    abilities: [
      ifThereAre(
        eachEnemy({ engagedWith: { ref: 'windowInvestigator' } }),
        { max: 0 },
        whenRevealed(takeHorror(1)),
      ),
    ],
  });

  it.each([
    { ghoulIs: 'engaged with alice', zone: engagedWith(alice), horror: 0 },
    { ghoulIs: 'engaged with bob', zone: engagedWith(bob), horror: 1 },
  ])('gives alice $horror horror while the ghoul is $ghoulIs', ({ zone, horror }) => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withInvestigator(bob, { locationId: hall })
      .withCard(ghoul, blankEnemy('ghoul'), zone)
      .withCard(omen, omenCard, encounterDeck)
      .start();

    const after = stateAfter(context, state, aliceDraws);

    expect(investigatorOf(after, alice).sanity.horror).toBe(horror);
  });
});

describe('a condition on the investigators at a location', () => {
  /** "Revelation – If there are no investigators in the study, take 1 horror." */
  const omenCard = blankTreachery('omen', {
    abilities: [
      ifThereAre(
        eachInvestigatorAt(onlyCopy(cardCode('study'))),
        { max: 0 },
        whenRevealed(takeHorror(1)),
      ),
    ],
  });

  it.each([
    { bobIn: hall, horror: 1 },
    { bobIn: study, horror: 0 },
  ])('gives alice $horror horror while bob is in the $bobIn', ({ bobIn, horror }) => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(study, blankLocation('study'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withInvestigator(bob, { locationId: bobIn })
      .withCard(omen, omenCard, encounterDeck)
      .start();

    const after = stateAfter(context, state, aliceDraws);

    expect(investigatorOf(after, alice).sanity.horror).toBe(horror);
  });
});

describe('a condition on the current agenda', () => {
  const firstAgenda = instanceId('first_agenda');
  const secondAgenda = instanceId('second_agenda');
  /** "Revelation – If it is agenda 2, take 1 horror." */
  const omenCard = blankTreachery('omen', {
    abilities: [duringAgenda([cardCode('second_agenda')], whenRevealed(takeHorror(1)))],
  });

  const twoAgendas = newGame()
    .withAgenda(firstAgenda, blankAgenda('first_agenda', fixed(5)))
    .withAgenda(secondAgenda, blankAgenda('second_agenda', fixed(5), { stage: { number: 2 } }))
    .withLocation(hall, blankLocation('hall'), { revealed: true })
    .withInvestigator(alice, { locationId: hall })
    .withCard(omen, omenCard, encounterDeck);

  it('gives alice no horror during the first agenda', () => {
    const { context, state } = twoAgendas.start();

    const after = stateAfter(context, state, aliceDraws);

    expect(investigatorOf(after, alice).sanity.horror).toBe(0);
  });

  it('gives alice 1 horror once the second agenda is current', () => {
    const { context, state } = twoAgendas.start();
    const advanced = stateAfter(context, state, { type: 'AdvanceAgenda' });

    const after = stateAfter(context, advanced, aliceDraws);

    expect(advanced.agenda.current).toBe(secondAgenda);
    expect(investigatorOf(after, alice).sanity.horror).toBe(1);
  });
});
