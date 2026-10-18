import { describe, expect, it } from 'vitest';
import {
  cardCode,
  decisionId,
  execute,
  instanceId,
  investigatorId,
  zoneKey,
  type Command,
  type EngineContext,
  type GameState,
  type InvestigatorId,
  type StartingCard,
  type Zone,
} from './index';
import {
  contextWith,
  fixed,
  investigatorOf,
  makeCard,
  makeInvestigator,
  rejectionFrom,
  startBoard,
  stateAfter,
} from '../test/utils';

/**
 * Rule interactions (M1V.2): situations where two rules meet in one moment
 * at the table, each set up in full in its test.
 */

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const carol = investigatorId('carol');
const hall = instanceId('hall');
const agenda = instanceId('agenda');
const aliceGhoul = instanceId('alice_ghoul');
const bobGhoul = instanceId('bob_ghoul');

/**
 * A hall, an agenda that advances at 3 doom into a second one, a ghoul that
 * deals 2 damage, and `deadly_treachery`, whose revelation defeats alice.
 */
const ctx: EngineContext = {
  ...contextWith(
    makeCard({ code: 'hall', typeCode: 'location' }),
    makeCard({ code: 'agenda_of_3', typeCode: 'agenda', stage: { number: 1 }, doom: fixed(3) }),
    makeCard({ code: 'agenda_of_9', typeCode: 'agenda', stage: { number: 2 }, doom: fixed(9) }),
    makeCard({ code: 'ghoul', typeCode: 'enemy', damage: 2, horror: 0 }),
    makeCard({ code: 'deadly_treachery', typeCode: 'treachery' }),
    makeCard({ code: 'plain_treachery', typeCode: 'treachery' }),
  ),
  effects: {
    [cardCode('deadly_treachery')]: {
      onReveal: () => [{ type: 'DefeatInvestigator', investigatorId: alice }],
    },
  },
};

const next: Command = { type: 'NextPhase' };
const engagedWith = (investigator: InvestigatorId): Zone => ({
  kind: 'engaged',
  investigatorId: investigator,
});
const placed = (id: string, code: string, zone: Zone, tokens = {}): StartingCard => ({
  id: instanceId(id),
  code: cardCode(code),
  zone,
  tokens,
});
const attack = (enemyId: typeof aliceGhoul, investigator: InvestigatorId): Command => ({
  type: 'ResolveEnemyAttack',
  enemyId,
  investigatorId: investigator,
});
const chooseLead = (investigator: InvestigatorId): Command => ({
  type: 'ResolveDecision',
  decisionId: decisionId('newLeadInvestigator'),
  optionId: investigator,
});
const turnsOf = (...investigators: InvestigatorId[]): Command[] =>
  investigators.flatMap((investigator): Command[] => [
    { type: 'StartTurn', investigatorId: investigator },
    { type: 'EndTurn', investigatorId: investigator },
  ]);

/**
 * Everyone named in `seats` stands in the hall, the first one is the lead.
 * Alice has 6 of her 8 health left damaged when `aliceHurt`, so one ghoul
 * attack (2 damage) defeats her. The agenda deck holds the agenda of 3 doom,
 * then the one of 9; `cards` come besides, the encounter deck unshuffled.
 */
function inTheHall(
  seats: InvestigatorId[],
  cards: StartingCard[],
  { aliceHurt = false } = {},
): GameState {
  return startBoard(ctx, {
    maps: { main: { locations: { hall: 'hall' } } },
    investigators: seats.map((id, seat) =>
      makeInvestigator({
        id,
        seat,
        locationId: hall,
        ...(id === alice && aliceHurt ? { health: { max: 8, damage: 6 } } : {}),
      }),
    ),
    shuffleEncounterDeck: false,
    cards: [
      placed('agenda', 'agenda_of_3', { kind: 'agendaDeck' }),
      placed('second_agenda', 'agenda_of_9', { kind: 'agendaDeck' }),
      ...cards,
    ],
  });
}

describe('the lead investigator is defeated during the enemy phase', () => {
  /** Alice (the lead, one attack from defeat), bob and carol; alice and bob each have a ghoul. */
  const enemyPhase = (): GameState =>
    stateAfter(
      ctx,
      inTheHall(
        [alice, bob, carol],
        [
          placed('alice_ghoul', 'ghoul', engagedWith(alice)),
          placed('bob_ghoul', 'ghoul', engagedWith(bob)),
        ],
        { aliceHurt: true },
      ),
      next,
      ...turnsOf(alice, bob, carol),
      next,
    );

  it('asks for a new lead before bob`s attack resolves', () => {
    const defeated = stateAfter(ctx, enemyPhase(), attack(aliceGhoul, alice));

    expect(defeated.pending.map((decision) => decision.id)).toEqual(['newLeadInvestigator']);
    expect(rejectionFrom(ctx, defeated, attack(bobGhoul, bob))).toMatchObject({
      code: 'decisionPending',
    });
  });

  it('resolves bob`s attack once the group has chosen the new lead', () => {
    const defeated = stateAfter(ctx, enemyPhase(), attack(aliceGhoul, alice), chooseLead(carol));

    const attacked = stateAfter(ctx, defeated, attack(bobGhoul, bob));

    expect(defeated.meta.leadInvestigator).toBe(carol);
    expect(investigatorOf(attacked, bob).health.damage).toBe(2);
  });
});

describe('the last investigator is defeated during the enemy phase', () => {
  it('ends the scenario, so the round goes no further', () => {
    const enemyPhase = stateAfter(
      ctx,
      inTheHall([alice], [placed('alice_ghoul', 'ghoul', engagedWith(alice))], { aliceHurt: true }),
      next,
      ...turnsOf(alice),
      next,
    );

    const defeated = stateAfter(ctx, enemyPhase, attack(aliceGhoul, alice));

    expect(defeated.meta.ended).toBe(true);
    expect(rejectionFrom(ctx, defeated, next)).toMatchObject({ code: 'scenarioEnded' });
  });
});

describe('the agenda advances during the enemy phase', () => {
  /**
   * Alice has a ghoul with 1 doom engaged; the agenda holds 1. A card effect
   * (entered as a correction) adds the third doom while the ghoul's attack
   * is due, and the group confirms the advance.
   */
  const advanced = (): GameState => {
    const enemyPhase = stateAfter(
      ctx,
      inTheHall([alice], [placed('alice_ghoul', 'ghoul', engagedWith(alice), { doom: 1 })]),
      {
        type: 'ManualAdjust',
        adjustment: { kind: 'tokens', cardId: agenda, token: 'doom', delta: 1 },
      },
      next,
      ...turnsOf(alice),
      next,
    );
    return stateAfter(
      ctx,
      enemyPhase,
      {
        type: 'ManualAdjust',
        adjustment: { kind: 'tokens', cardId: agenda, token: 'doom', delta: 1 },
      },
      { type: 'ResolveDecision', decisionId: decisionId('advanceAgenda:agenda'), optionId: 'yes' },
    );
  };

  it('removes the doom from the ghoul as well as the agenda', () => {
    expect(advanced().cards[aliceGhoul]?.tokens.doom ?? 0).toBe(0);
    expect(advanced().agenda.current).toBe(instanceId('second_agenda'));
  });

  it('still resolves the ghoul`s attack afterwards', () => {
    expect(advanced().meta.steps).toEqual([
      { id: 'enemiesAttack', attacks: [{ enemyId: aliceGhoul, investigatorId: alice }] },
    ]);
    expect(
      investigatorOf(stateAfter(ctx, advanced(), attack(aliceGhoul, alice)), alice).health.damage,
    ).toBe(2);
  });
});

describe('the lead investigator is defeated by their own mythos draw', () => {
  /** Round 2's mythos phase: alice (the lead) draws the deadly treachery, then bob and carol draw plain ones. */
  const drawn = (): GameState =>
    stateAfter(
      ctx,
      inTheHall(
        [alice, bob, carol],
        [
          placed('deadly_card', 'deadly_treachery', { kind: 'encounterDeck' }),
          placed('bob_card', 'plain_treachery', { kind: 'encounterDeck' }),
          placed('carol_card', 'plain_treachery', { kind: 'encounterDeck' }),
        ],
      ),
      next,
      ...turnsOf(alice, bob, carol),
      next,
      next,
      next,
    );

  it('stops the mythos phase for a new lead before bob draws', () => {
    expect(drawn().pending.map((decision) => decision.id)).toEqual(['newLeadInvestigator']);
    expect(drawn().order[zoneKey({ kind: 'encounterDeck' })]).toEqual(['bob_card', 'carol_card']);
  });

  it('lets bob and then carol draw once the new lead is chosen', () => {
    const chosen = stateAfter(ctx, drawn(), chooseLead(bob));

    const { events } = execute(ctx, chosen, next);

    expect(
      events.flatMap((e) =>
        e.type === 'EncounterCardDrawn' ? [`${e.investigatorId} draws ${e.cardId}`] : [],
      ),
    ).toEqual(['bob draws bob_card', 'carol draws carol_card']);
    expect(chosen.meta.leadInvestigator).toBe(bob);
  });
});

describe('an investigator leaves while engaged with a ready enemy, and bob stays at the location', () => {
  /** Alice and bob in the hall during alice's turn; alice's ghoul is ready and engaged with her. */
  const aliceTurn = (): GameState =>
    stateAfter(
      ctx,
      inTheHall([alice, bob], [placed('alice_ghoul', 'ghoul', engagedWith(alice))]),
      next,
      { type: 'StartTurn', investigatorId: alice },
    );

  it.each<{ how: string; leave: Command }>([
    { how: 'is defeated', leave: { type: 'DefeatInvestigator', investigatorId: alice } },
    { how: 'resigns', leave: { type: 'Resign', investigatorId: alice } },
  ])('the ghoul engages bob when alice $how', ({ leave }) => {
    const left = stateAfter(ctx, aliceTurn(), leave);

    expect(left.cards[aliceGhoul]?.zone).toEqual(engagedWith(bob));
  });
});
