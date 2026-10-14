import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CommandRejected,
  cardDbFrom,
  checkInvariants,
  emptyState,
  execute,
  instanceId,
  investigatorId,
  mapId,
  type CardStats,
  type Command,
  type EngineContext,
  type GameState,
  type StartingCard,
} from './index';

const main = mapId('main');
const hall = instanceId('hall');
const alice = investigatorId('alice');

const defs: CardStats[] = [
  { code: 'LOC', name: 'Fake Hall', typeCode: 'location', traits: [] },
  { code: 'FOE', name: 'Fake Foe', typeCode: 'enemy', traits: [] },
  { code: 'DUL', name: 'Fake Dull', typeCode: 'treachery', traits: [] },
  {
    code: 'SUR',
    name: 'Fake Surge',
    typeCode: 'treachery',
    traits: [],
    keywords: [{ name: 'surge' }],
  },
  {
    code: 'LNG',
    name: 'Fake Lingering',
    typeCode: 'treachery',
    traits: [],
    entersThreatArea: true,
  },
];
const ctx: EngineContext = { cards: cardDbFrom(defs) };
const encounterCodes = ['FOE', 'DUL', 'SUR', 'LNG'];

const codesArb = fc.array(fc.constantFrom(...encounterCodes), { maxLength: 8 });

type Step = { draw: true } | { shuffleInSetAside: string };

const stepArb: fc.Arbitrary<Step> = fc.oneof(
  { weight: 4, arbitrary: fc.constant<Step>({ draw: true }) },
  {
    weight: 1,
    arbitrary: fc
      .constantFrom(...encounterCodes)
      .map((code): Step => ({ shuffleInSetAside: code })),
  },
);

function started(seed: number, deck: string[], discard: string[], setAside: string[]): GameState {
  const placed = (
    prefix: string,
    codes: string[],
    kind: 'encounterDeck' | 'encounterDiscard' | 'setAside',
  ) =>
    codes.map((code, i): StartingCard => ({
      id: instanceId(`${prefix}${i}`),
      code,
      zone: { kind },
    }));
  return execute(ctx, emptyState(), {
    type: 'StartScenario',
    scenarioId: 'encounter-property',
    difficulty: 'standard',
    seed,
    investigators: [
      {
        id: alice,
        code: 'inv',
        name: 'Alice',
        seat: 1,
        locationId: hall,
        health: { max: 8, damage: 0 },
        sanity: { max: 8, horror: 0 },
        clues: 0,
        resources: 0,
        doomOnPlayerCards: 0,
        status: 'active',
      },
    ],
    maps: { [main]: { name: 'Main' } },
    cards: [
      { id: hall, code: 'LOC', zone: { kind: 'location', mapId: main }, faceUp: true },
      ...placed('d', deck, 'encounterDeck'),
      ...placed('x', discard, 'encounterDiscard'),
      ...placed('s', setAside, 'setAside'),
    ],
  }).state;
}

function commandOf(step: Step): Command {
  if ('draw' in step) return { type: 'DrawEncounter', investigatorId: alice };
  return { type: 'ShuffleInto', codes: [step.shuffleInSetAside], zone: { kind: 'encounterDeck' } };
}

describe('encounter deck properties', () => {
  it('draws, surges and reshuffles keep every card in exactly one zone', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        codesArb,
        codesArb,
        codesArb,
        fc.array(stepArb, { maxLength: 15 }),
        (seed, deck, discard, setAside, steps) => {
          let state = started(seed, deck, discard, setAside);
          const cardCount = Object.keys(state.cards).length;

          for (const step of steps) {
            try {
              state = execute(ctx, state, commandOf(step)).state;
            } catch (error) {
              if (!(error instanceof CommandRejected)) throw error;
            }

            expect(checkInvariants(state)).toEqual([]);
            expect(Object.keys(state.cards)).toHaveLength(cardCount);
          }
        },
      ),
    );
  });

  it('a draw only rejects when no encounter card or set-aside copy is available', () => {
    fc.assert(
      fc.property(fc.integer(), codesArb, codesArb, (seed, deck, discard) => {
        const state = started(seed, deck, discard, []);

        const outcome = () => execute(ctx, state, commandOf({ draw: true }));

        if (deck.length + discard.length === 0) expect(outcome).toThrow(CommandRejected);
        else expect(outcome()).toBeDefined();
      }),
    );
  });
});
