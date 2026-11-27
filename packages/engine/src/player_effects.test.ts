import { describe, expect, it } from 'vitest';
import {
  adjustStat,
  beneath,
  connectLocations,
  correctTokens,
  disconnectLocations,
  dealDamageTo,
  encounterDiscard,
  evadeEnemy,
  instanceId,
  investigatorId,
  mapId,
  move,
  moveAlong,
  moveEnemyTo,
  takeOneClue,
  type Adjustment,
  type Command,
} from './index';

const alice = investigatorId('alice');
const ghoul = instanceId('ghoul');
const hall = instanceId('hall');
const study = instanceId('study');

/** The builders whose shape carries a rule; the rest copy their arguments field by field. */
describe('what the play screen performs, built by name', () => {
  it.each<{ built: Command; expected: Command }>([
    {
      built: dealDamageTo(ghoul, 1),
      expected: { type: 'DamageEnemy', enemyId: ghoul, amount: 1 },
    },
    {
      built: evadeEnemy(ghoul, alice),
      expected: { type: 'EvadeEnemy', enemyId: ghoul, investigatorId: alice },
    },
    // A card that connects two locations connects them both ways.
    {
      built: connectLocations(study, hall, mapId('house')),
      expected: { type: 'AddConnection', mapId: mapId('house'), from: study, to: hall },
    },
    {
      built: disconnectLocations(study, hall),
      expected: { type: 'RemoveConnection', from: study, to: hall },
    },
    // Only the way the cards allow is left to cut.
    {
      built: disconnectLocations(study, hall, true),
      expected: { type: 'RemoveConnection', from: study, to: hall, oneWay: true },
    },
    // A dragged enemy goes there engaged or not.
    {
      built: moveEnemyTo(ghoul, study),
      expected: { type: 'MoveEnemy', enemyId: ghoul, to: study, forced: true },
    },
    // A dragged pawn keeps to the connections, and its cost to enter was paid at the table.
    {
      built: moveAlong(alice, study),
      expected: { type: 'MoveInvestigator', investigatorId: alice, to: study, paidAtTable: true },
    },
    {
      built: move(ghoul, encounterDiscard, 'top'),
      expected: { type: 'MoveCard', cardId: ghoul, to: encounterDiscard, index: 0 },
    },
    {
      built: move(ghoul, beneath(hall)),
      expected: { type: 'MoveCard', cardId: ghoul, to: beneath(hall) },
    },
    {
      built: takeOneClue(hall, alice),
      expected: { type: 'DiscoverClues', investigatorId: alice, locationId: hall, amount: 1 },
    },
    {
      built: adjustStat('horror', 1, alice),
      expected: { type: 'AdjustInvestigator', investigatorId: alice, stat: 'horror', delta: 1 },
    },
  ])('builds $expected.type', ({ built, expected }) => {
    expect(built).toEqual(expected);
  });

  it('builds a correction of the doom on the hall', () => {
    expect(correctTokens(hall, 'doom', -1)).toEqual<Adjustment>({
      kind: 'tokens',
      cardId: hall,
      token: 'doom',
      delta: -1,
    });
  });
});
