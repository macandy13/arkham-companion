import { describe, expect, it } from 'vitest';
import {
  checkInvariants,
  compileSetup,
  decisionId,
  execute,
  emptyState,
  enemyAttackList,
  instanceId,
  investigatorId,
  replay,
  undoLastGroup,
  type Command,
  type EngineContext,
  type Event,
  type GameState,
  type InstanceId,
  type InvestigatorId,
} from '@arkham/engine';
import { investigators, makeSetupOptions } from '@arkham/engine/test/utils';
import { GATHERING_CODES as codes, theGathering, theGatheringCards } from '../index';

const ctx: EngineContext = { cards: theGatheringCards, hooks: theGathering.hooks };

/** A persisted event as undo sees it: the command group it belongs to and the fact. */
interface LogEntry {
  commandId: string;
  event: Event;
}

/** One line per event: its type and, compactly, its other fields (the RNG state is noise). */
function formatEvent(event: Event): string {
  if (event.type === 'DecisionRequested') {
    const { id, kind, options } = event.decision;
    return `DecisionRequested ${id} (${kind}) options=${options.map((o) => o.id).join('|')}`;
  }
  const { type, ...fields } = event;
  const details = Object.entries(fields)
    .filter(([key]) => key !== 'rngState')
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`);
  return [type, ...details].join(' ');
}

/**
 * Drives The Gathering like the app store does: executes commands, keeps the
 * event log with command groups (so `undo` works like the store's), checks the
 * invariants after every step and writes a readable transcript for the golden file.
 */
class Playthrough {
  state: GameState = emptyState();
  readonly log: LogEntry[] = [];
  readonly transcript: string[] = [];
  /** Per `rerun`: the events of the first run and of the run after undo. */
  readonly reruns: { first: Event[]; again: Event[] }[] = [];
  private commands = 0;

  constructor(playerCount: number, seed: number) {
    const options = makeSetupOptions({ seed, investigators: investigators(playerCount) });
    this.run(compileSetup(ctx, theGathering, options));
  }

  run(command: Command): Event[] {
    const { events, state } = execute(ctx, this.state, command);
    this.state = state;
    const commandId = `c${(this.commands += 1)}`;
    this.log.push(...events.map((event) => ({ commandId, event })));
    expect(checkInvariants(this.state)).toEqual([]);
    const { type, ...fields } = command;
    this.transcript.push(
      `> ${type} ${type === 'StartScenario' ? '' : JSON.stringify(fields)}`.trimEnd(),
      ...events.map((event) => `    ${formatEvent(event)}`),
    );
    return events;
  }

  answer(id: string, optionId: string): Event[] {
    return this.run({ type: 'ResolveDecision', decisionId: decisionId(id), optionId });
  }

  /** Removes the last command group, like the store, and rebuilds the state from the rest. */
  undo(): void {
    const { kept, removed } = undoLastGroup(this.log);
    this.log.splice(kept.length);
    this.state = replay(kept.map((entry) => entry.event));
    this.transcript.push(`< Undo ${removed[0]?.commandId} (${removed.length} events)`);
  }

  /** Runs `command`, undoes it and runs it again, to show that a redo is identical. */
  rerun(command: Command): void {
    const first = this.run(command);
    this.undo();
    this.reruns.push({ first, again: this.run(command) });
  }

  next(): Event[] {
    return this.run({ type: 'NextPhase' });
  }

  /**
   * Plays on with `NextPhase` (resolving due enemy attacks with their printed
   * damage) until the next investigation phase starts or a decision is pending.
   */
  playRound(): void {
    do {
      const attack = this.dueAttack();
      if (attack) this.run({ type: 'ResolveEnemyAttack', ...attack });
      else this.next();
    } while (!this.roundStarted() && this.state.pending.length === 0);
  }

  investigate(who: InvestigatorId, outcome = 'pass'): void {
    this.run({ type: 'Investigate', investigatorId: who });
    this.answer(`investigate:${who}`, outcome);
  }

  fight(who: InvestigatorId, enemy: string, outcome = 'pass'): void {
    this.run({ type: 'Fight', investigatorId: who, enemyId: instanceId(enemy) });
    this.answer(`fight:${who}:${enemy}`, outcome);
  }

  evade(who: InvestigatorId, enemy: string): void {
    this.run({ type: 'Evade', investigatorId: who, enemyId: instanceId(enemy) });
    this.answer(`evade:${who}:${enemy}`, 'pass');
  }

  move(who: InvestigatorId, to: string): void {
    this.run({ type: 'MoveInvestigator', investigatorId: who, to: instanceId(to) });
  }

  endTurns(): void {
    for (const inv of this.state.investigators) {
      this.run({ type: 'EndTurn', investigatorId: inv.id });
    }
  }

  allEvents(): Event[] {
    return this.log.map((entry) => entry.event);
  }

  /**
   * The first attack step that is still due; a step whose investigator was
   * defeated meanwhile stays in the list but `NextPhase` skips it.
   */
  private dueAttack(): { enemyId: InstanceId; investigatorId: InvestigatorId } | undefined {
    const due = enemyAttackList(ctx, this.state);
    return this.state.meta.steps.flatMap((step) =>
      step.kind === 'enemyAttack' &&
      due.some((a) => a.enemyId === step.enemyId && a.investigatorId === step.investigatorId)
        ? [{ enemyId: step.enemyId, investigatorId: step.investigatorId }]
        : [],
    )[0];
  }

  private roundStarted(): boolean {
    return this.state.meta.phase === 'investigation' && this.state.meta.steps.length === 0;
  }
}

const tank = investigatorId('tank');
const seeker = investigatorId('seeker');
const id = (code: string, copy = 1) => `${code}#${copy}`;
const hallway = id(codes.hallway);
const attic = id(codes.attic);
const cellar = id(codes.cellar);
const swarmOfRats = id('01159', 2);
const icyGhoul = id('01119');
const ghoulMinion = (copy: number) => id('01160', copy);

/**
 * Seven rounds of The Gathering with seed 7 and two investigators, up to
 * where the scenario model ends: agenda 2 and act 3 have no hooks yet.
 */
function playGolden(): Playthrough {
  const game = new Playthrough(2, 7);
  game.next();
  game.investigate(tank);
  game.investigate(tank);
  game.investigate(seeker);
  game.investigate(seeker);
  game.rerun({
    type: 'AdvanceAct',
    spend: [
      { investigatorId: tank, amount: 2 },
      { investigatorId: seeker, amount: 2 },
    ],
  });
  game.endTurns();
  game.playRound();

  game.fight(seeker, ghoulMinion(1));
  game.move(tank, attic);
  game.investigate(tank);
  game.investigate(tank, 'fail');
  game.endTurns();
  game.playRound();

  game.fight(seeker, ghoulMinion(1));
  game.investigate(tank);
  game.investigate(tank);
  game.move(seeker, cellar);
  game.investigate(seeker);
  game.investigate(seeker);
  game.endTurns();
  game.playRound();

  game.answer(`advanceAgenda:${id(codes.whatsGoingOn)}`, 'yes');
  game.playRound();
  game.run({ type: 'Fight', investigatorId: seeker, enemyId: instanceId(ghoulMinion(3)) });
  game.answer(`fight:${seeker}:${ghoulMinion(3)}`, 'fail');
  game.undo();
  game.answer(`fight:${seeker}:${ghoulMinion(3)}`, 'pass');
  game.fight(seeker, ghoulMinion(3));
  game.investigate(seeker);
  game.rerun({
    type: 'AdvanceAct',
    spend: [
      { investigatorId: tank, amount: 3 },
      { investigatorId: seeker, amount: 3 },
    ],
  });
  game.endTurns();
  game.playRound();

  game.evade(tank, swarmOfRats);
  game.move(tank, hallway);
  game.fight(seeker, ghoulMinion(2));
  game.fight(seeker, ghoulMinion(2));
  game.evade(seeker, icyGhoul);
  game.endTurns();
  game.playRound();

  game.endTurns();
  game.playRound();
  return game;
}

describe('the golden playthrough of The Gathering', () => {
  const game = playGolden();

  it('matches the golden transcript', async () => {
    await expect(game.transcript.join('\n') + '\n').toMatchFileSnapshot('./playthrough.golden.txt');
  });

  it('replays the whole log to the live state', () => {
    expect(replay(game.allEvents())).toEqual(game.state);
  });

  it('redoes undone groups with identical events', () => {
    expect(game.reruns).toHaveLength(2);
    for (const { first, again } of game.reruns) {
      expect(first.length).toBeGreaterThan(0);
      expect(again).toEqual(first);
    }
  });
});

/**
 * A player-count-agnostic script: every round each active investigator
 * investigates once (alternating pass and fail) and ends their turn; pending
 * decisions are answered with their first option (the agenda confirmation, hunter ties).
 */
function playGeneric(playerCount: number, seed: number, rounds: number): Playthrough {
  const game = new Playthrough(playerCount, seed);
  game.next();
  for (let round = 1; round <= rounds; round++) {
    for (const inv of game.state.investigators) {
      game.investigate(inv.id, round % 2 === 0 ? 'fail' : 'pass');
    }
    game.endTurns();
    game.playRound();
    while (game.state.pending.length > 0) {
      const pending = game.state.pending[0]!;
      game.answer(pending.id, pending.options[0]!.id);
      game.playRound();
    }
  }
  return game;
}

describe('scripted playthroughs for different seeds and player counts', () => {
  it.each([
    { seed: 1, playerCount: 1 },
    { seed: 7, playerCount: 2 },
    { seed: 42, playerCount: 3 },
    { seed: 2026, playerCount: 4 },
  ])(
    'keeps the invariants and replays deterministically ($seed, $playerCount players)',
    (setup) => {
      const game = playGeneric(setup.playerCount, setup.seed, 5);
      const again = playGeneric(setup.playerCount, setup.seed, 5);

      expect(game.state.meta.round).toBeGreaterThanOrEqual(5);
      expect(replay(game.allEvents())).toEqual(game.state);
      expect(again.allEvents()).toEqual(game.allEvents());
    },
  );
});
