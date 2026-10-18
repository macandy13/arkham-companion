import { describe, expect, it } from 'vitest';
import {
  CommandRejected,
  blankAgenda,
  blankEnemy,
  blankLocation,
  blankTreachery,
  checkInvariants,
  emptyState,
  execute,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  replay,
  type Adjustment,
  type Event,
  type GameState,
} from './index';

const hall = instanceId('hall');
const ghoul = instanceId('ghoul');
const rat = instanceId('rat');
const dread = instanceId('dread');
const plan = instanceId('plan');
const alice = investigatorId('alice');

/**
 * Two investigators, lead investigator Alice, the hall, three encounter
 * cards (ghoul, rat and dread, shuffled with seed 99) and an agenda.
 */
const table = newGame()
  .withSeed(99)
  .withShuffledEncounterDeck()
  .withLocation(hall, blankLocation('hall'))
  .withInvestigator(alice)
  .withInvestigator(investigatorId('bob'))
  .withCard(ghoul, blankEnemy('ghoul'), { kind: 'encounterDeck' })
  .withCard(rat, blankEnemy('rat'), { kind: 'encounterDeck' })
  .withCard(dread, blankTreachery('dread'), { kind: 'encounterDeck' })
  .withAgenda(plan, blankAgenda('plan', fixed(3)));
const context = table.context();
const start = table.startCommand();

/** Plays `start` plus adjustments; rejected adjustments are skipped, like the app does. */
function play(adjustments: readonly Adjustment[]) {
  const started = execute(context, emptyState(), start);
  let state: GameState = started.state;
  const events: Event[] = [...started.events];
  const states: GameState[] = [state];
  for (const adjustment of adjustments) {
    try {
      const result = execute(context, state, { type: 'ManualAdjust', adjustment });
      state = result.state;
      events.push(...result.events);
      states.push(state);
    } catch (e) {
      if (!(e instanceof CommandRejected)) throw e;
    }
  }
  return { state, events, states };
}

/** Named adjustment scripts covering every zone kind, reordering, tokens and rejections. */
const scripts: [string, Adjustment[]][] = [
  ['no adjustments', []],
  [
    'moving cards between decks, the location and the victory display',
    [
      { kind: 'moveCard', cardId: ghoul, to: { kind: 'atLocation', locationId: hall } },
      { kind: 'moveCard', cardId: rat, to: { kind: 'encounterDiscard' } },
      { kind: 'moveCard', cardId: ghoul, to: { kind: 'victoryDisplay' } },
      { kind: 'moveCard', cardId: plan, to: { kind: 'outOfGame' } },
    ],
  ],
  [
    'reordering within the encounter deck',
    [
      { kind: 'moveCard', cardId: dread, to: { kind: 'encounterDeck' }, index: 0 },
      { kind: 'moveCard', cardId: ghoul, to: { kind: 'encounterDeck' }, index: 2 },
    ],
  ],
  [
    'engaging, threat area and attachments',
    [
      { kind: 'moveCard', cardId: ghoul, to: { kind: 'engaged', investigatorId: alice } },
      { kind: 'moveCard', cardId: dread, to: { kind: 'threatArea', investigatorId: alice } },
      { kind: 'moveCard', cardId: rat, to: { kind: 'attachedTo', hostId: plan } },
    ],
  ],
  [
    'adding and removing tokens down to zero',
    [
      { kind: 'tokens', cardId: hall, token: 'clue', delta: 3 },
      { kind: 'tokens', cardId: plan, token: 'doom', delta: 2 },
      { kind: 'tokens', cardId: hall, token: 'clue', delta: -3 },
    ],
  ],
  [
    'rejected adjustments in between (cycle, negative tokens, bad index)',
    [
      { kind: 'moveCard', cardId: rat, to: { kind: 'attachedTo', hostId: ghoul } },
      { kind: 'moveCard', cardId: ghoul, to: { kind: 'attachedTo', hostId: rat } },
      { kind: 'tokens', cardId: hall, token: 'damage', delta: -1 },
      { kind: 'moveCard', cardId: dread, to: { kind: 'encounterDeck' }, index: 9 },
      { kind: 'tokens', cardId: rat, token: 'horror', delta: 1 },
    ],
  ],
  [
    'counting actions down, with a rejected drop below zero',
    [
      { kind: 'actions', investigatorId: alice, delta: -2 },
      { kind: 'actions', investigatorId: alice, delta: -2 },
      { kind: 'actions', investigatorId: alice, delta: 1 },
    ],
  ],
];

describe('event log replay', () => {
  it.each(scripts)('replaying the events of %s yields the identical state', (_, adjustments) => {
    const { state, events } = play(adjustments);

    expect(replay(events)).toEqual(state);
  });

  it.each(scripts)('replaying a JSON copy of %s yields the identical state', (_, adjustments) => {
    const { state, events } = play(adjustments);

    const stored = JSON.parse(JSON.stringify(events)) as Event[];

    expect(replay(stored)).toEqual(state);
  });

  it.each(scripts)('%s produces the same events every time', (_, adjustments) => {
    expect(play(adjustments).events).toEqual(play(adjustments).events);
  });

  it.each(scripts)('%s keeps every card in exactly one zone after each step', (_, adjustments) => {
    const { states } = play(adjustments);

    expect(states.flatMap(checkInvariants)).toEqual([]);
    expect(states.map((s) => Object.keys(s.cards).length)).toEqual(states.map(() => 5));
  });
});
