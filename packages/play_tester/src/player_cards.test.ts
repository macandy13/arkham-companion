import { describe, expect, it } from 'vitest';
import { cardName } from '@arkham/engine';
import { unique } from '@arkham/util';
import { deckFor, playerCard } from './player_cards';
import { SeededRandom } from './run';

describe('a deck for the deck bot', () => {
  const roland = deckFor(cardName('Roland Banks'), new SeededRandom(7));

  it("has 30 cards of the investigator's classes and their signature card", () => {
    expect(roland).toHaveLength(31);
    expect(roland.map(({ name }) => name)).toContain("Roland's .38 Special");
    expect(unique(roland.flatMap((card) => (card.class ? [card.class] : [])))).toEqual(
      expect.arrayContaining(['guardian', 'seeker', 'neutral']),
    );
    expect(
      roland.every((card) => !card.class || ['guardian', 'seeker', 'neutral'].includes(card.class)),
    ).toBe(true);
  });

  it('holds two copies of a card at most', () => {
    const names = roland.map(({ name }) => name);

    expect(names.every((name) => names.filter((other) => other === name).length <= 2)).toBe(true);
  });

  it('is two copies of each of the 8 Neutral cards for a blank investigator', () => {
    const blank = deckFor(cardName('Blank 1'), new SeededRandom(7));

    expect(blank.every((card) => card.class === 'neutral')).toBe(true);
    expect(blank).toHaveLength(16);
  });
});

describe('a player card by name', () => {
  it('is the hand-entered card', () => {
    expect(playerCard(cardName('Machete'))).toMatchObject({
      type: 'asset',
      class: 'guardian',
      cost: 3,
    });
  });

  it('fails for a card the deck bot does not know', () => {
    expect(() => playerCard(cardName('Necronomicon'))).toThrow('knows no player card');
  });
});
