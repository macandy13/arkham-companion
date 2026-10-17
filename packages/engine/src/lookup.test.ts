import { describe, expect, it } from 'vitest';
import { cardCode, instanceId } from './index';
import { locationsInPlay, locationsNamed } from './board';
import { cardsAtLocation, cardsNamed, cardsOfType, requireCard } from './lookup';
import type { CardInstance } from './state';
import { contextWith, makeCard, rejectionOf, startBoard } from '../test/utils';

describe('requireCard', () => {
  const known = instanceId('known');
  const card: CardInstance = {
    id: known,
    code: cardCode('L1'),
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
  const ctx = contextWith(
    makeCard({ code: 'attic_location', name: 'Attic', typeCode: 'location' }),
    makeCard({ code: 'cellar_location', name: 'Cellar', typeCode: 'location' }),
    makeCard({ code: 'attic_ghoul', name: 'Attic', typeCode: 'enemy' }),
    makeCard({ code: 'relic', name: 'Relic', typeCode: 'asset' }),
  );
  const mainAttic = instanceId('main_attic');
  const mainCellar = instanceId('main_cellar');
  const setAsideAttic = instanceId('set_aside_attic');
  const atticGhoul = instanceId('attic_ghoul_card');
  const state = startBoard(ctx, {
    maps: { main: { locations: { main_attic: 'attic_location', main_cellar: 'cellar_location' } } },
    setAside: {
      set_aside_attic: 'attic_location',
      attic_ghoul_card: 'attic_ghoul',
      relic_card: 'relic',
    },
  });

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

describe('cardsAtLocation', () => {
  const ctx = contextWith(
    makeCard({ code: 'cellar', name: 'Cellar', typeCode: 'location' }),
    makeCard({ code: 'attic', name: 'Attic', typeCode: 'location' }),
    makeCard({ code: 'ghoul', name: 'Ghoul', typeCode: 'enemy' }),
    makeCard({ code: 'relic', name: 'Relic', typeCode: 'asset' }),
  );
  const cellar = instanceId('cellar');
  const attic = instanceId('attic');
  const cellarGhoul = instanceId('cellar_ghoul');
  const cellarRelic = instanceId('cellar_relic');
  const atticGhoul = instanceId('attic_ghoul');
  const state = startBoard(ctx, {
    maps: { main: { locations: { cellar: 'cellar', attic: 'attic' } } },
    cards: [
      {
        id: cellarGhoul,
        code: cardCode('ghoul'),
        zone: { kind: 'atLocation', locationId: cellar },
      },
      { id: atticGhoul, code: cardCode('ghoul'), zone: { kind: 'atLocation', locationId: attic } },
      {
        id: cellarRelic,
        code: cardCode('relic'),
        zone: { kind: 'atLocation', locationId: cellar },
      },
    ],
  });

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
