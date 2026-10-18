import { describe, expect, it } from 'vitest';
import { cardCode, instanceId, investigatorId } from './ids';
import { cluesToLocationEvents, discoverCluesEvents } from './investigators';
import { clearTokensEvents, moveCardEvent } from './placement';
import type { CardInstance } from './state';

const study = instanceId('study');
const ghoul = instanceId('ghoul');
const roland = investigatorId('roland');

describe('moveCardEvent', () => {
  it('moves the card from its current zone, to the end when no index is given', () => {
    const atStudy = { id: ghoul, zone: { kind: 'atLocation', locationId: study } } as const;
    expect(moveCardEvent(atStudy, { kind: 'encounterDiscard' })).toEqual({
      type: 'CardMoved',
      cardId: ghoul,
      from: { kind: 'atLocation', locationId: study },
      to: { kind: 'encounterDiscard' },
    });
  });

  it('puts the card at the given index, e.g. the top of the discard', () => {
    const inDeck = { id: ghoul, zone: { kind: 'encounterDeck' } } as const;
    expect(moveCardEvent(inDeck, { kind: 'encounterDiscard' }, 0)).toMatchObject({ index: 0 });
  });
});

describe('clearTokensEvents', () => {
  const ghoulWith = (tokens: CardInstance['tokens']): CardInstance => ({
    id: ghoul,
    code: cardCode('ghoul'),
    zone: { kind: 'atLocation', locationId: study },
    faceUp: true,
    exhausted: false,
    tokens,
    flags: {},
  });

  it('removes every token the card has, one event per kind', () => {
    expect(clearTokensEvents(ghoulWith({ doom: 2, damage: 3 }))).toEqual([
      { type: 'TokensChanged', cardId: ghoul, token: 'doom', delta: -2 },
      { type: 'TokensChanged', cardId: ghoul, token: 'damage', delta: -3 },
    ]);
  });

  it('removes only the kinds asked for, e.g. doom when the agenda advances', () => {
    expect(clearTokensEvents(ghoulWith({ doom: 2, damage: 3 }), ['doom'])).toEqual([
      { type: 'TokensChanged', cardId: ghoul, token: 'doom', delta: -2 },
    ]);
  });

  it('produces no event for a card without tokens', () => {
    expect(clearTokensEvents(ghoulWith({ doom: 0 }))).toEqual([]);
  });
});

describe('clues between an investigator and a location', () => {
  it('discovering moves clues from the location to the investigator and records the discovery', () => {
    expect(discoverCluesEvents(roland, study, 2)).toEqual([
      { type: 'TokensChanged', cardId: study, token: 'clue', delta: -2 },
      { type: 'InvestigatorChanged', investigatorId: roland, stat: 'clues', delta: 2 },
      { type: 'CluesDiscovered', investigatorId: roland, locationId: study, amount: 2 },
    ]);
  });

  it('placing them on the location is the reverse', () => {
    expect(cluesToLocationEvents(roland, study, 2)).toEqual([
      { type: 'InvestigatorChanged', investigatorId: roland, stat: 'clues', delta: -2 },
      { type: 'TokensChanged', cardId: study, token: 'clue', delta: 2 },
    ]);
  });
});
