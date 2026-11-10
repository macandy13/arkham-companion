import { describe, expect, it } from 'vitest';
import {
  blankEnemy,
  blankLocation,
  instanceId,
  investigatorId,
  newGame,
  trait,
  type InstanceId,
  type Zone,
} from './index';
import { preferredByPrey, preyPrompt } from './prey';
import type { BuiltGame } from './game_builder';

const hall = instanceId('hall');
const cellar = instanceId('cellar');
const attic = instanceId('attic');
const alice = investigatorId('alice');
const bob = investigatorId('bob');
const hunter = instanceId('hunter');
const setAside: Zone = { kind: 'setAside' };
const atLocation = (locationId: InstanceId): Zone => ({ kind: 'atLocation', locationId });

/** An enemy whose prey is `detail`. */
const preyCard = (detail: string, traits: string[] = []) =>
  blankEnemy('hunter', { keywords: [{ name: 'prey', detail }], traits: traits.map(trait) });

/** The investigators the prey of the hunter picks among `among` (everyone in `game` without it). */
function picked({ context, state }: BuiltGame, among?: readonly string[]): string[] {
  const enemy = state.cards[hunter];
  if (enemy === undefined) throw new Error('no hunter in the test game');
  const candidates = state.investigators.filter((inv) => among?.includes(inv.id) ?? true);
  return preferredByPrey(context, state, enemy, candidates).map((inv) => inv.id);
}

describe('preferredByPrey on counters and skills', () => {
  /**
   * Alice: 3 health left of 7, 5 sanity left of 6, 3 clues, 1 resource, combat 2.
   * Bob: 8 health left of 9, 3 sanity left of 6, 3 clues, 4 resources, combat 5.
   */
  const aliceAndBob = newGame()
    .withLocation(hall, blankLocation('hall'))
    .withInvestigator(alice, {
      locationId: hall,
      health: { max: 7, damage: 4 },
      sanity: { max: 6, horror: 1 },
      clues: 3,
      resources: 1,
      skills: { willpower: 3, intellect: 3, combat: 2, agility: 3 },
    })
    .withInvestigator(bob, {
      locationId: hall,
      health: { max: 9, damage: 1 },
      sanity: { max: 6, horror: 3 },
      clues: 3,
      resources: 4,
      skills: { willpower: 3, intellect: 3, combat: 5, agility: 3 },
    });

  it.each([
    { prey: 'Lowest remaining health', expected: ['alice'] },
    { prey: 'Least remaining health', expected: ['alice'] },
    { prey: 'Most remaining health', expected: ['bob'] },
    { prey: 'Lowest remaining sanity', expected: ['bob'] },
    { prey: 'Most remaining sanity', expected: ['alice'] },
    { prey: 'Most clues', expected: ['alice', 'bob'] },
    { prey: 'Most resources', expected: ['bob'] },
    { prey: 'Most damage', expected: ['alice'] },
    { prey: 'Most horror', expected: ['bob'] },
    { prey: 'Highest [combat]', expected: ['bob'] },
    { prey: 'Lowest [combat]', expected: ['alice'] },
    { prey: 'Fewest cards in hand', expected: ['alice', 'bob'] },
  ])('"$prey" picks $expected', ({ prey, expected }) => {
    const game = aliceAndBob.withCard(hunter, preyCard(prey), setAside).start();

    expect(picked(game)).toEqual(expected);
  });

  it('counts a lasting boost: alice, combat 2 boosted by 4, has the highest combat over bob at 5', () => {
    const game = newGame()
      .withLocation(hall, blankLocation('hall'))
      .withInvestigator(alice, {
        locationId: hall,
        skills: { willpower: 3, intellect: 3, combat: 2, agility: 3 },
        skillBoosts: { combat: 4 },
      })
      .withInvestigator(bob, {
        locationId: hall,
        skills: { willpower: 3, intellect: 3, combat: 5, agility: 3 },
      })
      .withCard(hunter, preyCard('Highest [combat]'), setAside)
      .start();

    expect(picked(game)).toEqual(['alice']);
  });

  it('ignores a defeated investigator', () => {
    const game = aliceAndBob
      .withInvestigator(investigatorId('carol'), {
        locationId: hall,
        health: { max: 1, damage: 1 },
        status: 'defeated',
      })
      .withCard(hunter, preyCard('Lowest remaining health'), setAside)
      .start();

    expect(picked(game)).toEqual(['alice']);
  });
});

describe('preferredByPrey "Nearest to another [[Cultist]] enemy"', () => {
  /** Hall - cellar - attic in a line; alice in the hall, bob in the attic. */
  const aliceAndBobApart = newGame()
    .withLocation(hall, blankLocation('hall'))
    .withLocation(cellar, blankLocation('cellar'))
    .withLocation(attic, blankLocation('attic'))
    .withConnection(hall, cellar)
    .withConnection(cellar, attic)
    .withInvestigator(alice, { locationId: hall })
    .withInvestigator(bob, { locationId: attic })
    .withCard(hunter, preyCard('Nearest to another Cultist enemy', ['Cultist']), atLocation(hall));
  const cultist = instanceId('cultist');
  const cultistCard = blankEnemy('cultist', { traits: [trait('Cultist')] });

  it('picks the investigator nearest to another Cultist, not to the enemy itself', () => {
    const game = aliceAndBobApart.withCard(cultist, cultistCard, atLocation(attic)).start();

    expect(picked(game)).toEqual(['bob']);
  });

  it('ignores enemies without the trait', () => {
    const game = aliceAndBobApart
      .withCard(cultist, cultistCard, atLocation(attic))
      .withCard(instanceId('ghoul'), blankEnemy('ghoul'), atLocation(hall))
      .start();

    expect(picked(game)).toEqual(['bob']);
  });

  it('leaves everyone tied with no other Cultist on the table', () => {
    const game = aliceAndBobApart.withCard(cultist, cultistCard, setAside).start();

    expect(picked(game)).toEqual(['alice', 'bob']);
  });
});

describe('preferredByPrey with "only" and naming texts', () => {
  /** Alice (3 sanity left) in the hall, a Woods location; Bob (5 sanity left) in the cellar. */
  const aliceInWoods = newGame()
    .withLocation(hall, blankLocation('hall', { traits: [trait('Woods')] }))
    .withLocation(cellar, blankLocation('cellar'))
    .withInvestigator(alice, { locationId: hall, sanity: { max: 6, horror: 3 } })
    .withInvestigator(bob, { locationId: cellar, sanity: { max: 6, horror: 1 } });

  it.each([
    { prey: 'Lowest remaining sanity only', among: ['alice', 'bob'], expected: ['alice'] },
    { prey: 'Lowest remaining sanity only', among: ['bob'], expected: [] },
    { prey: 'Lowest remaining sanity', among: ['bob'], expected: ['bob'] },
    { prey: 'Bob only', among: ['alice', 'bob'], expected: ['bob'] },
    { prey: 'Bob only', among: ['alice'], expected: [] },
    { prey: 'Investigator at a Woods location only', among: ['alice', 'bob'], expected: ['alice'] },
    { prey: 'Investigator at a Woods location only', among: ['bob'], expected: [] },
    { prey: 'Investigator at a Woods location', among: ['bob'], expected: ['bob'] },
    { prey: 'Carol only', among: ['alice', 'bob'], expected: ['alice', 'bob'] },
  ])('"$prey" picks $expected among $among', ({ prey, among, expected }) => {
    const game = aliceInWoods.withCard(hunter, preyCard(prey), setAside).start();

    expect(picked(game, among)).toEqual(expected);
  });
});

describe('preyPrompt', () => {
  it.each([
    {
      name: 'a prey the engine reads',
      keywords: [{ name: 'prey', detail: 'Most clues' }],
      prompt: 'decision.chooseEngagement',
    },
    { name: 'no prey', keywords: [], prompt: 'decision.chooseEngagement' },
    {
      name: 'a name no investigator has',
      keywords: [{ name: 'prey', detail: 'Bearer only' }],
      prompt: 'decision.choosePrey',
    },
    {
      name: 'a prey the players judge',
      keywords: [{ name: 'prey', detail: 'Fewest cards in hand' }],
      prompt: 'decision.choosePrey',
    },
  ] as const)('asks with $prompt for $name', ({ keywords, prompt }) => {
    const card = blankEnemy('hunter', { keywords: [...keywords] });

    expect(preyPrompt(newGame().start().state, card, 'decision.chooseEngagement')).toBe(prompt);
  });
});
