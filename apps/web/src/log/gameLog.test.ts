import { beforeAll, describe, expect, it } from 'vitest';
import {
  blankAgenda,
  blankEnemy,
  blankLocation,
  blankTreachery,
  byName,
  engagedWith,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  skillTest,
  whenRevealed,
} from '@arkham/engine';
import type { TFunction } from 'i18next';
import { initI18n } from '../i18n';
import { gameLog } from './gameLog';

const study = instanceId('study');
const hallway = instanceId('hallway');
const roland = investigatorId('roland');

/** The lines of the last step played on `table`, in English. */
const lastStepOf = (t: TFunction, table: PlayTable) =>
  gameLog(t, table.ctx, table.state, table.entries).at(-1)?.lines;

describe('gameLog', () => {
  let t: TFunction;
  beforeAll(async () => {
    t = (await initI18n('en')).t;
  });

  /** Roland Banks in the revealed Study, connected to the Hallway (1 clue); his turn has begun. */
  const rolandsTurn = newGame()
    .withLocation(study, blankLocation('Study'), { revealed: true })
    .withLocation(hallway, blankLocation('Hallway', { clues: fixed(1) }))
    .withConnection(study, hallway)
    .withAgenda(instanceId('agenda'), blankAgenda('What Lurks Below', fixed(5)))
    .withInvestigator(roland, { name: 'Roland Banks', locationId: study })
    .withTurnOf(roland);

  it('starts with the scenario', () => {
    const table = PlayTable.start(newGame());

    expect(gameLog(t, table.ctx, table.state, table.entries)[0]?.lines).toEqual([
      'The scenario begins',
    ]);
  });

  it('gives each step its own lines, named by its undo group', () => {
    const table = PlayTable.start(rolandsTurn);
    const stepsBefore = gameLog(t, table.ctx, table.state, table.entries).length;

    table.takeDamage(byName('Roland Banks'), 2);
    table.takeHorror(byName('Roland Banks'), 1);

    const steps = gameLog(t, table.ctx, table.state, table.entries).slice(stepsBefore);
    expect(steps.map((step) => step.lines)).toEqual([
      ['Roland Banks takes 2 damage'],
      ['Roland Banks takes 1 horror'],
    ]);
    expect(steps[0]?.id).not.toEqual(steps[1]?.id);
  });

  it('says where an investigator moved and what the move revealed', () => {
    const table = PlayTable.start(rolandsTurn);

    table.moveTo(byName('Roland Banks'), byName('Hallway'));

    expect(lastStepOf(t, table)).toEqual([
      'Roland Banks moves to Hallway',
      'Hallway is revealed',
      '1 clue on Hallway',
    ]);
  });

  it('names an investigation by its test and the clues found, without the counters it moved', () => {
    const table = PlayTable.start(rolandsTurn);
    table.moveTo(byName('Roland Banks'), byName('Hallway'));

    table.investigate(byName('Roland Banks'));

    expect(lastStepOf(t, table)).toEqual([
      'Roland Banks: Intellect test (0) passed',
      'Roland Banks discovers 1 clue at Hallway',
    ]);
  });

  it.each([
    { step: (table: PlayTable) => table.placeDoom(2), line: '2 doom on What Lurks Below' },
    {
      step: (table: PlayTable) => {
        table.placeDoom(2);
        table.removeDoom(1);
      },
      line: '1 doom removed from What Lurks Below',
    },
    {
      step: (table: PlayTable) => table.gainResources(byName('Roland Banks'), 1),
      line: 'Roland Banks gains 1 resource',
    },
    {
      step: (table: PlayTable) => table.spendResources(byName('Roland Banks'), 3),
      line: 'Roland Banks spends 3 resources',
    },
    {
      step: (table: PlayTable) => table.drawCard(byName('Roland Banks')),
      line: 'Roland Banks draws 1 card',
    },
  ])('says "$line"', ({ step, line }) => {
    const table = PlayTable.start(rolandsTurn);

    step(table);

    expect(lastStepOf(t, table)).toEqual([line]);
  });

  it('names the encounter card drawn and its failed test', () => {
    const table = PlayTable.start(
      rolandsTurn
        .withCard(
          instanceId('grasping_hands'),
          blankTreachery('Grasping Hands', { abilities: [whenRevealed(skillTest('agility', 3))] }),
          { kind: 'encounterDeck' },
        )
        // A card left in the deck, so the discard pile isn't shuffled back once the deck runs out.
        .withCard(instanceId('next_card'), blankTreachery('Next card'), { kind: 'encounterDeck' }),
    );
    table.drawEncounterCard(byName('Roland Banks'));

    table.answer(byName('Grasping Hands'), 'fail');

    expect(
      gameLog(t, table.ctx, table.state, table.entries)
        .slice(-2)
        .map((s) => s.lines),
    ).toEqual([['Roland Banks draws Grasping Hands'], ['Roland Banks: Agility test (3) failed']]);
  });

  it('tells an enemy engaging, attacking and being defeated', () => {
    const table = PlayTable.start(
      rolandsTurn.withCard(
        instanceId('ghoul'),
        blankEnemy('Ghoul', { damage: 1 }),
        engagedWith(roland),
      ),
    );

    table.fight(byName('Roland Banks'), byName('Ghoul'));

    expect(lastStepOf(t, table)).toEqual([
      'Roland Banks: Combat test (0) passed',
      '1 damage on Ghoul',
      'Ghoul is defeated',
    ]);
  });

  it('marks the phases and turns', () => {
    const table = PlayTable.start(rolandsTurn);

    table.endTurn(byName('Roland Banks'));

    expect(lastStepOf(t, table)).toEqual(["Roland Banks's turn ends"]);
  });
});
