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
  type Phase,
  skillTest,
  whenRevealed,
} from '@arkham/engine';
import type { TFunction } from 'i18next';
import { initI18n } from '../i18n';
import { gameLog, newestFirst, type LogStep } from './gameLog';

const study = instanceId('study');
const hallway = instanceId('hallway');
const roland = investigatorId('roland');

/** The log of `table`, in English, without store times. */
const logOf = (t: TFunction, table: PlayTable) =>
  gameLog(t, table.ctx, table.state, { entries: table.entries, stepTimes: new Map() });

/** What the lines of `step` say. */
const textOf = (step: LogStep | undefined) => step?.lines.map((line) => line.text);

/** The lines of the last step played on `table`, in English. */
const lastStepOf = (t: TFunction, table: PlayTable) => textOf(logOf(t, table).at(-1));

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

    expect(textOf(logOf(t, table)[0])).toEqual(['The scenario begins']);
  });

  it('gives each step its own lines, named by its undo group, with the groups after it', () => {
    const table = PlayTable.start(rolandsTurn);
    const stepsBefore = logOf(t, table).length;

    table.takeDamage(byName('Roland Banks'), 2);
    table.takeHorror(byName('Roland Banks'), 1);

    const steps = logOf(t, table).slice(stepsBefore);
    expect(steps.map(textOf)).toEqual([
      ['Roland Banks takes 2 damage'],
      ['Roland Banks takes 1 horror'],
    ]);
    expect(steps[0]?.id).not.toEqual(steps[1]?.id);
    expect(steps.map((step) => step.later)).toEqual([1, 0]);
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

    expect(logOf(t, table).slice(-2).map(textOf)).toEqual([
      ['Roland Banks draws Grasping Hands'],
      ['Roland Banks: Agility test (3) failed'],
    ]);
  });

  it('tells a fight that defeats an enemy', () => {
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

  it('marks the end of a turn and the next phase', () => {
    const table = PlayTable.start(rolandsTurn);
    const stepsBefore = logOf(t, table).length;

    table.endTurn(byName('Roland Banks'));
    table.nextPhase();

    const steps = logOf(t, table).slice(stepsBefore);
    expect(steps.map(textOf)).toEqual([["Roland Banks's turn ends"], ['Enemy phase begins']]);
  });

  it('tells an enemy spawning, then moving in and engaging', () => {
    const table = PlayTable.start(
      rolandsTurn
        .withCard(
          instanceId('ghoul'),
          blankEnemy('Ghoul', { keywords: [{ name: 'spawn', detail: 'Hallway' }] }),
          { kind: 'encounterDeck' },
        )
        .withCard(instanceId('next_card'), blankTreachery('Next card'), { kind: 'encounterDeck' }),
    );
    table.drawEncounterCard(byName('Roland Banks'));

    table.moveEnemy(byName('Ghoul'), byName('Study'));

    expect(logOf(t, table).slice(-2).map(textOf)).toEqual([
      ['Roland Banks draws Ghoul', 'Ghoul spawns at Hallway'],
      ['Ghoul moves to Study', 'Ghoul engages Roland Banks'],
    ]);
  });

  it('gives each step the round and phase it ends in and whose turn it was', () => {
    const table = PlayTable.start(rolandsTurn);
    const stepsBefore = logOf(t, table).length;

    table.takeDamage(byName('Roland Banks'), 2);
    table.endTurn(byName('Roland Banks'));
    table.nextPhase();

    const steps = logOf(t, table).slice(stepsBefore);
    expect(steps.map(({ round, phase, actor }) => ({ round, phase, actor }))).toEqual([
      { round: 1, phase: 'investigation', actor: 'Roland Banks' },
      { round: 1, phase: 'investigation', actor: 'Roland Banks' },
      { round: 1, phase: 'enemy', actor: undefined },
    ]);
  });

  it('names the event and the actor of each line', () => {
    const table = PlayTable.start(rolandsTurn);

    table.moveTo(byName('Roland Banks'), byName('Hallway'));

    expect(logOf(t, table).at(-1)?.lines).toEqual([
      { event: 'InvestigatorMoved', actor: 'Roland Banks', text: 'Roland Banks moves to Hallway' },
      { event: 'CardFlipped', text: 'Hallway is revealed' },
      { event: 'TokensChanged', text: '1 clue on Hallway' },
    ]);
  });

  it('dates each step by when it was stored', () => {
    const table = PlayTable.start(rolandsTurn);
    table.takeDamage(byName('Roland Banks'), 2);
    const damageStep = table.entries.at(-1)?.commandId ?? '';

    const steps = gameLog(t, table.ctx, table.state, {
      entries: table.entries,
      stepTimes: new Map([[damageStep, 1_800_000_000_000]]),
    });

    expect(steps.at(-1)?.timestamp).toBe(1_800_000_000_000);
  });
});

describe('newestFirst', () => {
  /** A step of `round` and `phase` with one line, `text`. */
  const step = (id: string, round: number, phase: Phase, text: string): LogStep => ({
    id,
    round,
    phase,
    lines: [{ event: 'TokensChanged', text }],
  });

  it('puts the newest round and phase first, its newest step leading', () => {
    const doom = step('doom', 2, 'mythos', '1 doom on the agenda');
    const draw = step('draw', 2, 'mythos', 'Roland Banks draws Ghoul');
    const turn = step('turn', 2, 'investigation', "Roland Banks's turn begins");

    expect(newestFirst([doom, draw, turn])).toEqual([
      { round: 2, phase: 'investigation', steps: [turn] },
      { round: 2, phase: 'mythos', steps: [draw, doom] },
    ]);
  });
});
