import { describe, expect, it } from 'vitest';
import {
  CommandRejected,
  cardCode,
  checkInvariants,
  emptyState,
  execute,
  instanceId,
  investigatorId,
  mapId,
  replay,
  type Adjustment,
  type Event,
  type GameState,
  type StartScenario,
} from './index';
import { investigators, testContext } from '../test/utils';

const main = mapId('main');
const hall = instanceId('hall');
const ghoul = instanceId('ghoul');
const rat = instanceId('rat');
const dread = instanceId('dread');
const plan = instanceId('plan');
const lead = investigatorId('tank');

/** Two investigators, a location, three encounter cards and an agenda. */
const start: StartScenario = {
  type: 'StartScenario',
  scenarioId: 'replay',
  difficulty: 'standard',
  seed: 99,
  investigators: investigators(2),
  maps: { [main]: { name: 'Main' } },
  cards: [
    { id: hall, code: cardCode('L1'), zone: { kind: 'location', mapId: main } },
    { id: ghoul, code: cardCode('E1'), zone: { kind: 'encounterDeck' } },
    { id: rat, code: cardCode('E2'), zone: { kind: 'encounterDeck' } },
    { id: dread, code: cardCode('E3'), zone: { kind: 'encounterDeck' } },
    { id: plan, code: cardCode('A1'), zone: { kind: 'agendaDeck' } },
  ],
};

/** Plays `start` plus adjustments; rejected adjustments are skipped, like the app does. */
function play(adjustments: readonly Adjustment[]) {
  const started = execute(testContext, emptyState(), start);
  let state: GameState = started.state;
  const events: Event[] = [...started.events];
  const states: GameState[] = [state];
  for (const adjustment of adjustments) {
    try {
      const result = execute(testContext, state, { type: 'ManualAdjust', adjustment });
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
      { kind: 'moveCard', cardId: ghoul, to: { kind: 'engaged', investigatorId: lead } },
      { kind: 'moveCard', cardId: dread, to: { kind: 'threatArea', investigatorId: lead } },
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
      { kind: 'actions', investigatorId: lead, delta: -2 },
      { kind: 'actions', investigatorId: lead, delta: -2 },
      { kind: 'actions', investigatorId: lead, delta: 1 },
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
