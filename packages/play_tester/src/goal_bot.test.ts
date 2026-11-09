import { describe, expect, it } from 'vitest';
import {
  blankEnemy,
  blankLocation,
  cardName,
  engagedWith,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  blankTreachery,
  takeDamage,
  whenRevealed,
} from '@arkham/engine';
import { goalWeights } from './goal_bot';
import { offeredSteps } from './random_bot';
import type { Step } from './steps';

const alice = investigatorId('alice');
const hall = instanceId('hall');
const study = instanceId('study');
const cellar = instanceId('cellar');
const attic = instanceId('attic');
const ghoul = instanceId('ghoul');

/** The steps the goal bot wants on `table`: those it weighs above the rest. */
function wanted(table: PlayTable): Step[] {
  const offered = offeredSteps(table);
  const weights = goalWeights(table, offered);
  const most = Math.max(...weights);
  return offered.filter((_, i) => weights[i] === most);
}

describe('the steps the goal bot wants', () => {
  /** A hall without clues; the study one step away has clues, the attic two steps away too. */
  const map = newGame()
    .withLocation(hall, blankLocation('hall'), { revealed: true })
    .withLocation(study, blankLocation('study'), { revealed: true, clues: 2 })
    .withLocation(cellar, blankLocation('cellar'), { revealed: true })
    .withLocation(attic, blankLocation('attic'), { revealed: true, clues: 1 })
    .withConnection(hall, study)
    .withConnection(hall, cellar)
    .withConnection(cellar, attic);
  const game = map.withInvestigator(alice, { locationId: hall }).withTurnOf(alice);

  it('moves towards the nearest clues', () => {
    expect(wanted(PlayTable.start(game))).toEqual([
      { verb: 'moveTo', investigator: cardName('alice'), location: cardName('study') },
    ]);
  });

  it('resolves a drawn treachery`s revelation and never cancels it', () => {
    const table = PlayTable.start(
      game
        .withCard(
          instanceId('burning_treachery'),
          blankTreachery('burning_treachery', { abilities: [whenRevealed(takeDamage(1))] }),
          { kind: 'encounterDeck' },
        )
        .withCard(instanceId('next_card'), blankTreachery('next_card'), {
          kind: 'encounterDeck',
        }),
    );
    table.play({ type: 'DrawEncounter', investigatorId: alice });

    const offered = offeredSteps(table);
    const weights = goalWeights(table, offered);

    expect(offered.filter((_, i) => weights[i]! > 0)).toEqual([
      { verb: 'answer', about: 'burning_treachery', option: 'resolve revelation' },
    ]);
  });

  it('investigates where there are clues', () => {
    const table = PlayTable.start(
      map.withInvestigator(alice, { locationId: study }).withTurnOf(alice),
    );

    expect(wanted(table)).toContainEqual({ verb: 'investigate', investigator: cardName('alice') });
  });

  it('fights the enemy engaged with it', () => {
    const table = PlayTable.start(game.withCard(ghoul, blankEnemy('ghoul'), engagedWith(alice)));

    expect(wanted(table)).toContainEqual({
      verb: 'fight',
      investigator: cardName('alice'),
      enemy: 'ghoul',
    });
  });

  it('ends its turn once its actions are spent', () => {
    const table = PlayTable.start(game);
    table.spendAction(alice);
    table.spendAction(alice);
    table.spendAction(alice);

    expect(wanted(table)).toContainEqual({ verb: 'endTurn', investigator: cardName('alice') });
  });

  it('never undoes or corrects the board', () => {
    const table = PlayTable.start(game);
    table.moveTo(alice, study);
    const offered = offeredSteps(table);

    const weights = goalWeights(table, offered);

    expect(offered.filter((_, i) => weights[i] === 0)).toEqual(
      expect.arrayContaining([
        { verb: 'undo' },
        { verb: 'placeDoom' },
        { verb: 'takeDamage', investigator: cardName('alice') },
      ]),
    );
  });
});
