import { describe, expect, it } from 'vitest';
import {
  CommandRejected,
  cardDbFrom,
  cardStats,
  clueValue,
  enemyHealth,
  perInvestigator,
  type CardStats,
} from './index';

/** A card definition with boring defaults; tests pass only the fields they assert on. */
function makeCard(overrides: Partial<CardStats> & { code: string }): CardStats {
  return { name: overrides.code, typeCode: 'treachery', traits: [], ...overrides };
}

describe('cardDbFrom', () => {
  it('looks up a definition by code', () => {
    const agenda = makeCard({ code: 'agenda', typeCode: 'agenda', doom: 4 });
    const cards = cardDbFrom([agenda]);

    const stats = cards.get('agenda');

    expect(stats?.doom).toBe(4);
  });

  it('returns undefined for an unknown code', () => {
    const cards = cardDbFrom([makeCard({ code: 'known' })]);

    expect(cards.get('unknown')).toBeUndefined();
  });

  it('lets a later definition replace an earlier one with the same code', () => {
    const cards = cardDbFrom([
      makeCard({ code: 'loc', shroud: 1 }),
      makeCard({ code: 'loc', shroud: 3 }),
    ]);

    expect(cards.get('loc')?.shroud).toBe(3);
  });
});

describe('cardStats', () => {
  it('reads an agenda doom threshold through the card db', () => {
    const cards = cardDbFrom([makeCard({ code: 'agenda', typeCode: 'agenda', doom: 6 })]);

    expect(cardStats(cards, 'agenda').doom).toBe(6);
  });

  it('rejects an unknown code', () => {
    const cards = cardDbFrom([]);

    const lookup = () => cardStats(cards, 'nope');

    expect(lookup).toThrow(CommandRejected);
    expect(lookup).toThrow('no card definition for code nope');
  });
});

describe('perInvestigator', () => {
  it('multiplies the printed value by the player count', () => {
    expect(perInvestigator(2, 3)).toBe(6);
  });
});

describe('clueValue', () => {
  it('scales clues with the player count', () => {
    const act = makeCard({ code: 'act', typeCode: 'act', clues: 2 });

    expect(clueValue(act, 3)).toBe(6);
  });

  it('keeps fixed clues regardless of player count', () => {
    const location = makeCard({ code: 'loc', typeCode: 'location', clues: 2, cluesFixed: true });

    expect(clueValue(location, 3)).toBe(2);
  });

  it('is undefined for a card without clues', () => {
    expect(clueValue(makeCard({ code: 'none' }), 3)).toBeUndefined();
  });
});

describe('enemyHealth', () => {
  it('keeps printed health when it is not per investigator', () => {
    const enemy = makeCard({ code: 'enemy', typeCode: 'enemy', health: 3 });

    expect(enemyHealth(enemy, 4)).toBe(3);
  });

  it('scales health per investigator', () => {
    const enemy = makeCard({
      code: 'enemy',
      typeCode: 'enemy',
      health: 2,
      healthPerInvestigator: true,
    });

    expect(enemyHealth(enemy, 4)).toBe(8);
  });

  it('is undefined for a card without health', () => {
    expect(enemyHealth(makeCard({ code: 'none' }), 4)).toBeUndefined();
  });
});
