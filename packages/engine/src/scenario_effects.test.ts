import { describe, expect, it } from 'vitest';
import {
  advanceAgenda,
  afterEntering,
  blankAgenda,
  blankLocation,
  blankTreachery,
  cardCode,
  encounterDeck,
  encounterDiscard,
  execute,
  fixed,
  instanceId,
  investigatorId,
  neighbours,
  newGame,
  onlyCopy,
  removeConnection,
  setAside,
  shuffleSelfIntoEncounterDeck,
  shuffleSetAsideIntoEncounterDeck,
  whenRevealed,
  type Command,
} from './index';
import { requireInvestigator } from './investigators';
import { stateAfter } from '../test/utils';

const hall = instanceId('hall');
const study = instanceId('study');
const attic = instanceId('attic');
const alice = investigatorId('alice');

/** Alice is moved from the hall into the attic by an effect. */
const aliceEntersAttic: Command = {
  type: 'MoveInvestigator',
  investigatorId: alice,
  to: attic,
  ignoreConnections: true,
};

describe('a card effect that advances the agenda', () => {
  it('advances the current agenda and removes its doom', () => {
    const agenda1 = instanceId('agenda1');
    const agenda2 = instanceId('agenda2');
    /** "After you enter the attic: advance the current agenda." */
    const atticCard = blankLocation('attic', { abilities: [afterEntering(advanceAgenda())] });
    const { context, state } = newGame()
      .withAgenda(agenda1, blankAgenda('first_agenda', fixed(5)))
      .withAgenda(agenda2, blankAgenda('second_agenda', fixed(5), { stage: { number: 2 } }))
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(attic, atticCard, { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .start();
    const withDoom = stateAfter(context, state, { type: 'PlaceDoom', amount: 2 });

    const after = stateAfter(context, withDoom, aliceEntersAttic);

    expect(withDoom.cards[agenda1]?.tokens.doom).toBe(2);
    expect(after.agenda.current).toBe(agenda2);
    expect(after.cards[agenda1]?.tokens.doom).toBeUndefined();
  });
});

describe('a card effect that removes a connection', () => {
  it('leaves the hall and the study unconnected once alice enters the attic', () => {
    /** "After you enter the attic: the hall is no longer connected to the study." */
    const atticCard = blankLocation('attic', {
      abilities: [
        afterEntering(removeConnection(onlyCopy(cardCode('hall')), onlyCopy(cardCode('study')))),
      ],
    });
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(study, blankLocation('study'), { revealed: true })
      .withLocation(attic, atticCard, { revealed: true })
      .withConnection(hall, study)
      .withInvestigator(alice, { locationId: hall })
      .start();

    const after = stateAfter(context, state, aliceEntersAttic);

    expect(neighbours(context, state, hall)).toEqual([study]);
    expect(neighbours(context, after, hall)).toEqual([]);
  });

  it('changes nothing when the connection is already gone', () => {
    /** "After you enter the attic: the hall is no longer connected to the study." */
    const atticCard = blankLocation('attic', {
      abilities: [
        afterEntering(removeConnection(onlyCopy(cardCode('hall')), onlyCopy(cardCode('study')))),
      ],
    });
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(study, blankLocation('study'), { revealed: true })
      .withLocation(attic, atticCard, { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .start();

    const after = stateAfter(context, state, aliceEntersAttic);

    expect(requireInvestigator(after, alice)).toMatchObject({ locationId: attic });
    expect(neighbours(context, after, hall)).toEqual([]);
  });
});

describe('card effects that shuffle cards into the encounter deck', () => {
  const omen = instanceId('omen');
  const filler = instanceId('filler');
  const fillerCard = blankTreachery('filler');

  it('shuffles a drawn treachery back into the encounter deck instead of discarding it', () => {
    /** "Revelation – Shuffle it into the encounter deck." */
    const omenCard = blankTreachery('omen', {
      abilities: [whenRevealed(...shuffleSelfIntoEncounterDeck())],
    });
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(omen, omenCard, encounterDeck)
      .withCard(filler, fillerCard, encounterDeck)
      .start();

    const after = stateAfter(context, state, { type: 'DrawEncounter', investigatorId: alice });

    expect(after.cards[omen]?.zone).toEqual(encounterDeck);
    expect(after.cards[filler]?.zone).toEqual(encounterDeck);
  });

  it('shuffles a set-aside card into the encounter deck', () => {
    const lurker = instanceId('lurker');
    /** "Revelation – Shuffle the set-aside Lurker into the encounter deck." */
    const omenCard = blankTreachery('omen', {
      abilities: [whenRevealed(shuffleSetAsideIntoEncounterDeck([cardCode('lurker')]))],
    });
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(omen, omenCard, encounterDeck)
      .withCard(lurker, blankTreachery('lurker'), setAside)
      .start();

    const after = stateAfter(context, state, { type: 'DrawEncounter', investigatorId: alice });

    expect(after.cards[lurker]?.zone).toEqual(encounterDeck);
    expect(after.cards[omen]?.zone).toEqual(encounterDiscard);
  });

  it('shuffles nothing in when the card is not set aside', () => {
    /** "Revelation – Shuffle the set-aside Lurker into the encounter deck." */
    const omenCard = blankTreachery('omen', {
      abilities: [whenRevealed(shuffleSetAsideIntoEncounterDeck([cardCode('lurker')]))],
    });
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(omen, omenCard, encounterDeck)
      .withCard(filler, fillerCard, encounterDeck)
      .start();

    const { state: after, events } = execute(context, state, {
      type: 'DrawEncounter',
      investigatorId: alice,
    });

    expect(after.cards[omen]?.zone).toEqual(encounterDiscard);
    expect(after.cards[filler]?.zone).toEqual(encounterDeck);
    expect(events.map((event) => event.type)).not.toContain('DeckShuffled');
  });
});
