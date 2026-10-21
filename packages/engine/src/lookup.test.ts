import { describe, expect, it } from 'vitest';
import {
  atLocation,
  blankAct,
  blankAgenda,
  blankAsset,
  blankEnemy,
  blankLocation,
  cardCode,
  fixed,
  instanceId,
  newGame,
} from './index';
import { locationsInPlay, locationsNamed } from './board';
import {
  cardsAtLocation,
  cardsNamed,
  cardsOfType,
  currentCard,
  requireCard,
  zoneOf,
} from './lookup';
import type { CardInstance } from './state';
import { rejectionOf } from '../test/utils';

describe('requireCard', () => {
  const known = instanceId('known');
  const card: CardInstance = {
    id: known,
    code: cardCode('known_card'),
    zone: { kind: 'outOfGame' },
    faceUp: true,
    exhausted: false,
    flags: {},
    tokens: {},
  };

  it('returns the card with that id', () => {
    expect(requireCard({ [known]: card }, known)).toBe(card);
  });

  it('rejects an id that names no card', () => {
    const missing = instanceId('missing');

    expect(rejectionOf(() => requireCard({ [known]: card }, missing))).toEqual({
      code: 'unknownCard',
      cardId: missing,
    });
  });
});

describe('card queries', () => {
  /** Two locations and an enemy share the name Attic, so name searches find cards of several types. */
  const atticLocation = blankLocation('attic_location', { name: 'Attic' });
  const cellarLocation = blankLocation('cellar_location', { name: 'Cellar' });
  const atticGhoulCard = blankEnemy('attic_ghoul', { name: 'Attic' });
  const relicCard = blankAsset('relic', { name: 'Relic' });
  const mainAttic = instanceId('main_attic');
  const mainCellar = instanceId('main_cellar');
  const setAsideAttic = instanceId('set_aside_attic');
  const atticGhoul = instanceId('attic_ghoul_card');
  const { context: ctx, state } = newGame()
    .withLocation(mainAttic, atticLocation)
    .withLocation(mainCellar, cellarLocation)
    .withCard(setAsideAttic, atticLocation, { kind: 'setAside' })
    .withCard(atticGhoul, atticGhoulCard, { kind: 'setAside' })
    .withCard(instanceId('relic_card'), relicCard, { kind: 'setAside' })
    .start();

  it('finds all cards of a type, wherever they are', () => {
    const ids = cardsOfType(ctx, state, 'location').map((card) => card.id);

    expect(ids).toEqual([mainAttic, mainCellar, setAsideAttic]);
  });

  it.each([
    { name: 'ignoring case', text: 'aTTic', expected: [mainAttic, setAsideAttic, atticGhoul] },
    {
      name: 'ignoring a trailing dot',
      text: 'Attic.',
      expected: [mainAttic, setAsideAttic, atticGhoul],
    },
    { name: 'ignoring surrounding spaces', text: ' Cellar ', expected: [mainCellar] },
    { name: 'finding nothing for an unknown name', text: 'Parlor', expected: [] },
  ])('finds cards by name, $name', ({ text, expected }) => {
    expect(cardsNamed(ctx, state, text).map((card) => card.id)).toEqual(expected);
  });

  it('narrows a name search to one card type', () => {
    const ids = cardsNamed(ctx, state, 'Attic', { typeCode: 'enemy' }).map((card) => card.id);

    expect(ids).toEqual([atticGhoul]);
  });

  it('finds locations in play, and by name with or without the ones that are not in play', () => {
    expect(locationsInPlay(ctx, state).map((card) => card.id)).toEqual([mainAttic, mainCellar]);
    expect(locationsNamed(ctx, state, 'Attic').map((card) => card.id)).toEqual([
      mainAttic,
      setAsideAttic,
    ]);
    expect(locationsNamed(ctx, state, 'Attic', { inPlay: true }).map((card) => card.id)).toEqual([
      mainAttic,
    ]);
  });
});

describe('zoneOf', () => {
  const relic = instanceId('relic');
  const { state } = newGame().withCard(relic, blankAsset('relic'), { kind: 'setAside' }).start();

  it.each([
    { name: 'the zone of a card in the state', cardId: relic, zone: { kind: 'setAside' } },
    { name: 'nothing for a card not in the state', cardId: instanceId('nowhere'), zone: undefined },
  ])('returns $name', ({ cardId, zone }) => {
    expect(zoneOf(state, cardId)).toEqual(zone);
  });
});

describe('cardsAtLocation', () => {
  const ghoulCard = blankEnemy('ghoul');
  const relicCard = blankAsset('relic');
  const cellar = instanceId('cellar');
  const attic = instanceId('attic');
  const cellarGhoul = instanceId('cellar_ghoul');
  const cellarRelic = instanceId('cellar_relic');
  const atticGhoul = instanceId('attic_ghoul');
  const { state } = newGame()
    .withLocation(cellar, blankLocation('cellar'))
    .withLocation(attic, blankLocation('attic'))
    .withCard(cellarGhoul, ghoulCard, atLocation(cellar))
    .withCard(atticGhoul, ghoulCard, atLocation(attic))
    .withCard(cellarRelic, relicCard, atLocation(cellar))
    .start();

  it('finds the cards at one location, of any type, in card order', () => {
    expect(cardsAtLocation(state, cellar).map((card) => card.id)).toEqual([
      cellarGhoul,
      cellarRelic,
    ]);
  });

  it('finds nothing at a location no card stands at', () => {
    expect(cardsAtLocation(state, instanceId('nowhere'))).toEqual([]);
  });
});

describe('currentCard', () => {
  const firstAgenda = instanceId('first_agenda');
  const firstAct = instanceId('first_act');
  const secondAct = instanceId('second_act');

  it('returns the current agenda and act', () => {
    const { state } = newGame()
      .withAgenda(firstAgenda, blankAgenda('first_agenda', fixed(3)))
      .withAct(firstAct, blankAct('first_act'))
      .withAct(secondAct, blankAct('second_act'))
      .start();

    expect(currentCard(state, 'agenda')?.id).toBe(firstAgenda);
    expect(currentCard(state, 'act')?.id).toBe(firstAct);
  });

  it('returns nothing for a deck without a current card', () => {
    const { state } = newGame().start();

    expect(currentCard(state, 'act')).toBeUndefined();
  });
});
