import { describe, expect, it } from 'vitest';
import {
  blankAgenda,
  blankLocation,
  blankTreachery,
  changeNotices,
  noticeKindOf,
  execute,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  placeDoomOnAgenda,
  skillTest,
  takeHorror,
  whenAdvanced,
  whenRevealed,
  type ChangeNotice,
  type Command,
  type Event,
  type ExecuteResult,
  type NoticeKind,
} from './index';
import { answer, stateAfter } from '../test/utils';

const agenda = instanceId('agenda');
const lastAgenda = instanceId('last_agenda');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const rottingTreachery = instanceId('rotting_treachery');
const testingTreachery = instanceId('testing_treachery');
const alice = investigatorId('alice');
const encounterDeck = { kind: 'encounterDeck' } as const;

/** A notice as these tests compare it: its kind, its cause and the types of its events. */
interface NoticeShape {
  readonly kind: ChangeNotice['kind'];
  readonly cause: ChangeNotice['cause'];
  readonly events: readonly Event['type'][];
}

function noticesOf(result: ExecuteResult): NoticeShape[] {
  return changeNotices(result).map(({ kind, cause, events }) => ({
    kind,
    cause,
    events: events.map((event) => event.type),
  }));
}

/** Alice in the revealed hall, with an agenda of 9 doom: nothing advances on its own. */
const hallTable = newGame()
  .withAgenda(agenda, blankAgenda('agenda', fixed(9)))
  .withLocation(hall, blankLocation('hall'), { revealed: true })
  .withInvestigator(alice, { locationId: hall });

const next: Command = { type: 'NextPhase' };
/** Round 1 from setup to the upkeep phase, so the next `NextPhase` runs the mythos phase of round 2. */
const toUpkeep: Command[] = [
  next,
  { type: 'StartTurn', investigatorId: alice },
  { type: 'EndTurn', investigatorId: alice },
  next,
  next,
];

describe('changeNotices', () => {
  it("gives the cellar's revealed doom for alice's move into it, not the move itself", () => {
    const { context, state } = hallTable
      .withLocation(
        cellar,
        blankLocation('dooming_cellar', { abilities: [whenRevealed(placeDoomOnAgenda(1))] }),
      )
      .withConnection(hall, cellar)
      .start();

    const result = execute(context, state, {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: cellar,
    });

    expect(noticesOf(result)).toEqual([
      {
        kind: 'tokens',
        cause: { kind: 'card', cardId: cellar, window: { kind: 'revealed' } },
        events: ['TokensChanged'],
      },
    ]);
  });

  it('gives the mythos doom and draw as the rules’, the drawn treachery’s horror as the card’s', () => {
    const { context, state } = hallTable
      .withCard(
        rottingTreachery,
        blankTreachery('rotting_treachery', { abilities: [whenRevealed(takeHorror(1))] }),
        encounterDeck,
      )
      .start();
    const upkeep = stateAfter(context, state, ...toUpkeep);

    const result = execute(context, upkeep, next);

    const drawStep = { kind: 'rule', step: 'drawEncounterCard' } as const;
    expect(noticesOf(result)).toEqual([
      { kind: 'tokens', cause: { kind: 'rule', step: 'placeDoom' }, events: ['TokensChanged'] },
      { kind: 'encounter', cause: drawStep, events: ['EncounterCardDrawn'] },
      { kind: 'board', cause: drawStep, events: ['CardMoved', 'CardFlipped'] },
      {
        kind: 'investigator',
        cause: { kind: 'card', cardId: rottingTreachery, window: { kind: 'revealed' } },
        events: ['InvestigatorChanged'],
      },
      // The treachery goes to the discard pile, which is shuffled back into the empty deck.
      { kind: 'board', cause: drawStep, events: ['CardMoved', 'CardMoved'] },
      { kind: 'encounter', cause: drawStep, events: ['DeckShuffled'] },
    ]);
  });

  it("gives an agenda's reverse side as the card's once the players confirm its advance", () => {
    const { context, state } = newGame()
      .withAgenda(
        agenda,
        blankAgenda('agenda_of_one', fixed(1), { abilities: [whenAdvanced(placeDoomOnAgenda(1))] }),
      )
      .withAgenda(lastAgenda, blankAgenda('last_agenda', fixed(9), { stage: { number: 2 } }))
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .start();
    // The mythos doom reaches the threshold of 1; the players confirm the advance (`agendaThresholdDecision`).
    const asked = stateAfter(context, state, ...toUpkeep, next);

    const result = execute(context, asked, answer('advanceAgenda:agenda', 'yes'));

    expect(noticesOf(result)).toEqual([
      {
        kind: 'tokens',
        cause: { kind: 'card', cardId: agenda, window: { kind: 'advanced' } },
        events: ['TokensChanged'],
      },
    ]);
  });

  it('keeps the cause of a mythos draw whose revelation test waits for the players', () => {
    const { context, state } = hallTable
      .withCard(
        testingTreachery,
        blankTreachery('testing_treachery', {
          abilities: [whenRevealed(skillTest('willpower', 3))],
        }),
        encounterDeck,
      )
      .start();
    const asked = stateAfter(context, state, ...toUpkeep, next);

    const result = execute(context, asked, answer('test:testing_treachery', 'pass'));

    // Placing the drawn card waited in the state for the answer, and is still the draw's.
    const drawStep = { kind: 'rule', step: 'drawEncounterCard' } as const;
    expect(noticesOf(result)).toEqual([
      { kind: 'board', cause: drawStep, events: ['CardMoved', 'CardMoved'] },
      { kind: 'encounter', cause: drawStep, events: ['DeckShuffled'] },
    ]);
  });

  it('gives one notice for two changes of one kind by the same card', () => {
    const { context, state } = hallTable
      .withLocation(
        cellar,
        blankLocation('twice_dooming_cellar', {
          abilities: [whenRevealed(placeDoomOnAgenda(1), placeDoomOnAgenda(1))],
        }),
      )
      .withConnection(hall, cellar)
      .start();

    const result = execute(context, state, {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: cellar,
    });

    expect(noticesOf(result)).toEqual([
      {
        kind: 'tokens',
        cause: { kind: 'card', cardId: cellar, window: { kind: 'revealed' } },
        events: ['TokensChanged', 'TokensChanged'],
      },
    ]);
  });

  it("gives no notice for alice's own card action, though it is the card's effect", () => {
    const { context, state } = newGame()
      .withLocation(
        hall,
        blankLocation('scary_hall', { actions: [{ effects: [takeHorror(1)] }] }),
        {
          revealed: true,
        },
      )
      .withInvestigator(alice, { locationId: hall })
      .withTurnOf(alice)
      .start();

    const result = execute(context, state, {
      type: 'UseCardAction',
      investigatorId: alice,
      cardId: hall,
      action: 0,
    });

    expect(result.events.map((event) => event.type)).toContain('InvestigatorChanged');
    expect(changeNotices(result)).toEqual([]);
  });

  it('gives no notice for what the players do themselves', () => {
    const { context, state } = hallTable.start();
    const investigation = stateAfter(context, state, next);

    const result = execute(context, investigation, { type: 'StartTurn', investigatorId: alice });

    expect(result.causes.every((cause) => cause.kind === 'player')).toBe(true);
    expect(changeNotices(result)).toEqual([]);
  });
});

describe('noticeKindOf', () => {
  it.each<{ event: Event; kind: NoticeKind | undefined }>([
    {
      event: { type: 'ExhaustChanged', cardId: instanceId('ghoul'), exhausted: false },
      kind: 'enemy',
    },
    { event: { type: 'SurgeGained', cardId: rottingTreachery }, kind: 'encounter' },
    {
      event: { type: 'ChaosBagChanged', token: 'cultist', change: 'add', lasts: 'scenario' },
      kind: 'chaosBag',
    },
    {
      event: {
        type: 'CommandDeferred',
        command: { type: 'DrawCards', investigatorId: alice, amount: 1 },
      },
      kind: 'byHand',
    },
    { event: { type: 'RoundEnded', round: 1 }, kind: undefined },
  ])('files $event.type under $kind', ({ event, kind }) => {
    expect(noticeKindOf(event)).toBe(kind);
  });
});
