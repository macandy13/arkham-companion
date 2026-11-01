import { describe, expect, it } from 'vitest';
import {
  cardDbWith,
  investigatorCardStats,
  investigatorCode,
  investigatorId,
  PlayTable,
  type InvestigatorCard,
} from '@arkham/engine';
import { scenarioCatalog } from './scenarioCatalog';

describe('scenarioCatalog', () => {
  const alder: InvestigatorCard = {
    code: investigatorCode('alder'),
    name: 'Alder',
    health: 6,
    sanity: 8,
    skills: { willpower: 3, intellect: 3, combat: 3, agility: 3 },
  };

  it.each(scenarioCatalog.map((entry) => ({ id: entry.id, entry })))(
    'sets up $id standalone with its catalog cards alone, the encounter deck shuffled',
    ({ entry }) => {
      const table = PlayTable.setUp(
        {
          cards: cardDbWith(entry.cards, [investigatorCardStats(alder)]),
          scenario: entry.definition,
        },
        { seed: 1, investigators: [{ id: investigatorId('alder'), code: alder.code }] },
      );

      const encounterDeck = Object.values(table.state.cards).filter(
        (card) => card.zone.kind === 'encounterDeck',
      );
      expect(encounterDeck.length).toBeGreaterThan(0);
    },
  );
});
