import { describe, expect, it } from 'vitest';
import {
  resolutionId,
  atEndOfPhase,
  atEndOfEachTurn,
  atEndOfRound,
  healSelf,
  gainSurge,
  ifYouHave,
  readySelf,
  atEndOfTurn,
  advanceAct,
  afterAttacking,
  afterDiscoveringClues,
  afterEngaging,
  afterEntering,
  afterTest,
  atLocation,
  attachedTo,
  blankAct,
  blankAgenda,
  blankAsset,
  blankEnemy,
  blankLocation,
  blankTreachery,
  cardCode,
  checkInvariants,
  decisionId,
  defeatEachInvestigator,
  discardEachEnemyAt,
  discardSelf,
  eachInvestigatorAt,
  engagedWith,
  duringAct,
  endScenario,
  execute,
  fixed,
  instanceId,
  investigatorId,
  itsLocation,
  leadDecides,
  mapId,
  MAX_TRIGGERED_COMMANDS,
  moveEachInvestigatorTo,
  moveSelf,
  newGame,
  setAside,
  shuffleEncounterDiscard,
  leadDrawsDiscardingUntil,
  onlyCopy,
  perInvestigator,
  placeDoomOnAgenda,
  placeDoomOnSelf,
  putMapIntoPlay,
  putSetAsideIntoPlay,
  removeFromGame,
  revealLocation,
  skillTest,
  spawnEnemyAt,
  spendClues,
  moveTo,
  putIntoThreatArea,
  takeDamage,
  takeHorror,
  threatAreaOf,
  whenAdvanced,
  whenDefeated,
  whenEnemyDefeated,
  whenRevealed,
  whenTurnBegins,
  youMustEither,
  zoneKey,
  type AbilityEffect,
  type AddMapStep,
  type Command,
  type Zone,
} from './index';
import { requireInvestigator } from './investigators';
import { answer, rejectionFrom, stateAfter } from '../test/utils';

const hall = instanceId('hall');
const cellar = instanceId('cellar');
const agenda1 = instanceId('agenda1');
const agenda2 = instanceId('agenda2');
const act1 = instanceId('act1');
const act2 = instanceId('act2');
const alice = investigatorId('alice');

/** The first agenda advances at 3 doom, the second at 5. */
const firstAgendaCard = blankAgenda('first_agenda', fixed(3));
const secondAgendaCard = blankAgenda('second_agenda', fixed(5), { stage: { number: 2 } });
/** The first act needs 2 clues per investigator. */
const firstActCard = blankAct('first_act', { clues: perInvestigator(2) });
const secondActCard = blankAct('second_act', { stage: { number: 2 } });
/** The cellar has clues, so revealing it places them (a `TokensChanged` after its `CardFlipped`). */
const cellarCard = blankLocation('cellar', { clues: perInvestigator(2) });
const ghoulCard = blankEnemy('ghoul');

describe('trigger bus', () => {
  it('fires no forced effects for the setup: a location set up revealed', () => {
    const doomingHall = blankLocation('dooming_hall', {
      abilities: [whenRevealed(placeDoomOnAgenda(1))],
    });
    const { state } = newGame()
      .withAgenda(agenda1, firstAgendaCard)
      .withLocation(hall, doomingHall, { revealed: true })
      .start();

    expect(state.cards[hall]?.faceUp).toBe(true);
    expect(state.cards[agenda1]?.tokens.doom).toBeUndefined();
  });

  it('runs the reverse side of the advancing agenda before the next one becomes current', () => {
    const revealingAgenda = blankAgenda('revealing_agenda', fixed(3), {
      abilities: [whenAdvanced(revealLocation(onlyCopy(cardCode('cellar'))))],
    });
    const { context: ctx, state: started } = newGame()
      .withAgenda(agenda1, revealingAgenda)
      .withAgenda(agenda2, secondAgendaCard)
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(cellar, cellarCard)
      .withInvestigator(alice, { locationId: hall })
      .start();

    const { events, state } = execute(ctx, started, { type: 'AdvanceAgenda' });

    expect(events.map((event) => event.type)).toEqual([
      'CardFlipped',
      'AgendaAdvanced',
      'CardFlipped',
      'TokensChanged',
      'CardMoved',
      'CurrentCardChanged',
    ]);
    expect(state.agenda.current).toBe(agenda2);
    expect(state.cards[cellar]?.faceUp).toBe(true);
  });

  describe('the reverse side of the last agenda', () => {
    /** "(→R2)" on the back of the last agenda, after the first one. */
    const endingAgenda = blankAgenda('ending_agenda', fixed(5), {
      stage: { number: 2 },
      abilities: [whenAdvanced(endScenario(resolutionId('R2')))],
    });
    const lastAgendaTable = newGame()
      .withAgenda(agenda1, firstAgendaCard)
      .withAgenda(agenda2, endingAgenda);

    it('ends the scenario with its resolution', () => {
      const { context: ctx, state: started } = lastAgendaTable.start();
      const lastAgenda = stateAfter(ctx, started, { type: 'AdvanceAgenda' });

      const { events, state } = execute(ctx, lastAgenda, { type: 'AdvanceAgenda' });

      expect(events.map((event) => event.type).slice(-3)).toEqual([
        'ScenarioEnded',
        'CardMoved',
        'CurrentCardChanged',
      ]);
      expect(state.meta.resolution).toBe('R2');
      expect(state.agenda.current).toBeUndefined();
    });

    it('wins over the fallback resolution', () => {
      const { context: ctx, state: started } = lastAgendaTable.start();
      const lastAgenda = stateAfter(ctx, started, { type: 'AdvanceAgenda' });

      const { events, state } = execute(ctx, lastAgenda, {
        type: 'AdvanceAgenda',
        resolution: resolutionId('R1'),
      });

      expect(events.filter((event) => event.type === 'ScenarioEnded')).toEqual([
        { type: 'ScenarioEnded', resolution: resolutionId('R2') },
      ]);
      expect(state.meta.resolution).toBe('R2');
    });
  });

  describe('revealed abilities', () => {
    /**
     * The cellar's revealed ability places 1 doom on the agenda and deals 1
     * horror to whoever the window names; dooming_agenda has the same doom
     * ability. Alice stands next to the unrevealed cellar.
     */
    const doomingCellar = blankLocation('dooming_cellar', {
      abilities: [whenRevealed(placeDoomOnAgenda(1), takeHorror(1))],
    });
    const doomingAgenda = blankAgenda('dooming_agenda', fixed(3), {
      abilities: [whenRevealed(placeDoomOnAgenda(1))],
    });
    const revealTable = newGame()
      .withAgenda(instanceId('dooming_agenda'), doomingAgenda)
      .withAgenda(instanceId('second_agenda'), secondAgendaCard)
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(cellar, doomingCellar)
      .withConnection(hall, cellar)
      .withInvestigator(alice, { locationId: hall });

    it('runs the abilities of a card turned face up', () => {
      const { context, state: started } = revealTable.start();

      const { state } = execute(context, started, { type: 'RevealLocation', locationId: cellar });

      expect(state.cards[instanceId('dooming_agenda')]?.tokens.doom).toBe(1);
    });

    it('places doom on the card itself when the ability names it', () => {
      const cursedCellar = blankLocation('cursed_cellar', {
        abilities: [whenRevealed(placeDoomOnSelf(1))],
      });
      const { context, state: started } = newGame()
        .withAgenda(instanceId('second_agenda'), secondAgendaCard)
        .withLocation(cellar, cursedCellar)
        .start();

      const { state } = execute(context, started, { type: 'RevealLocation', locationId: cellar });

      expect(state.cards[cellar]?.tokens.doom).toBe(1);
      expect(state.cards[instanceId('second_agenda')]?.tokens.doom).toBeUndefined();
    });

    it('resolves them within the move that revealed the location, naming no investigator', () => {
      const { context, state: started } = revealTable.start();

      const { state } = execute(context, started, {
        type: 'MoveInvestigator',
        investigatorId: alice,
        to: cellar,
      });

      expect(state.cards[instanceId('dooming_agenda')]?.tokens.doom).toBe(1);
      expect(state.investigators.find((inv) => inv.id === alice)?.sanity.horror).toBe(0);
      expect(checkInvariants(state)).toEqual([]);
    });

    it('drops an effect whose nested reference names nobody', () => {
      const clingingCellar = blankLocation('clinging_cellar', {
        abilities: [
          whenRevealed(
            moveSelf({ kind: 'threatArea', investigatorId: { ref: 'windowInvestigator' } }),
          ),
        ],
      });
      const { context, state: started } = newGame()
        .withLocation(cellar, clingingCellar)
        .withInvestigator(alice)
        .start();

      const { state } = execute(context, started, { type: 'RevealLocation', locationId: cellar });

      expect(state.cards[cellar]?.zone.kind).toBe('location');
    });

    it('does not run them when a card is turned face down', () => {
      const { context, state: started } = revealTable.start();

      const { events } = execute(context, started, { type: 'AdvanceAgenda' });

      // The flipped agenda leaves the game afterwards, so only the events show whether it placed doom.
      expect(events.filter((e) => e.type === 'TokensChanged' && e.delta > 0)).toEqual([]);
    });
  });

  describe('abilities after entering a location', () => {
    const bob = investigatorId('bob');
    const attic = instanceId('attic');
    /** The attic deals 1 horror to whoever enters it. */
    const atticCard = blankLocation('attic', { abilities: [afterEntering(takeHorror(1))] });
    /** Alice in the hall, bob already in the revealed attic next to it. */
    const atticTable = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(attic, atticCard, { revealed: true })
      .withConnection(hall, attic)
      .withInvestigator(alice, { locationId: hall })
      .withInvestigator(bob, { locationId: attic });

    it.each<{ name: string; move: Command }>([
      {
        name: 'moving there',
        move: { type: 'MoveInvestigator', investigatorId: alice, to: attic },
      },
      {
        name: 'being moved there by an effect',
        move: {
          type: 'MoveInvestigator',
          investigatorId: alice,
          to: attic,
          ignoreConnections: true,
        },
      },
    ])('deals the horror to alice for $name, not to bob who was there', ({ move }) => {
      const { context, state: started } = atticTable.start();

      const { state } = execute(context, started, move);

      expect(requireInvestigator(state, alice).sanity.horror).toBe(1);
      expect(requireInvestigator(state, bob).sanity.horror).toBe(0);
    });

    it('fires when the move reveals the location too', () => {
      const { context, state: started } = newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withLocation(attic, atticCard)
        .withConnection(hall, attic)
        .withInvestigator(alice, { locationId: hall })
        .start();

      const { state } = execute(context, started, {
        type: 'MoveInvestigator',
        investigatorId: alice,
        to: attic,
      });

      expect(requireInvestigator(state, alice).sanity.horror).toBe(1);
    });

    it('opens no window for an investigator who starts there', () => {
      const { state } = atticTable.start();

      expect(requireInvestigator(state, bob).sanity.horror).toBe(0);
      expect(state.pending).toEqual([]);
    });

    it('opens no window for an investigator without a location placed there', () => {
      const { context, state: started } = newGame()
        .withLocation(attic, atticCard, { revealed: true })
        .withInvestigator(alice)
        .start();

      const { state } = execute(context, started, {
        type: 'MoveInvestigator',
        investigatorId: alice,
        to: attic,
      });

      expect(requireInvestigator(state, alice)).toMatchObject({ locationId: attic });
      expect(requireInvestigator(state, alice).sanity.horror).toBe(0);
    });
  });

  describe('turn-end and round-end abilities', () => {
    const endTurnOfAlice: Command = { type: 'EndTurn', investigatorId: alice };
    /** From alice's turn, `endTurnOfAlice` and two of these end round 1 (the enemy and upkeep phases). */
    const nextPhase: Command = { type: 'NextPhase' };
    const hauntingDread = instanceId('haunting_dread');
    /** A threat-area treachery: at the end of its holder's turn, willpower (3); a fail deals 1 horror. */
    const hauntingDreadCard = blankTreachery('haunting_dread', {
      abilities: [atEndOfTurn(skillTest('willpower', 3, { onFail: [takeHorror(1)] }))],
    });

    it.each([
      { result: 'pass', horror: 0 },
      { result: 'fail', horror: 1 },
    ])(
      '$result: the test outcome acts on the investigator whose turn ended',
      ({ result, horror }) => {
        const { context, state } = newGame()
          .withLocation(hall, blankLocation('hall'), { revealed: true })
          .withInvestigator(alice, { locationId: hall })
          .withCard(hauntingDread, hauntingDreadCard, threatAreaOf(alice))
          .withTurnOf(alice)
          .start();

        const after = stateAfter(
          context,
          state,
          { type: 'EndTurn', investigatorId: alice },
          answer('test:haunting_dread', result),
        );

        expect(after.investigators.find((inv) => inv.id === alice)?.sanity.horror).toBe(horror);
        expect(after.cards[hauntingDread]?.zone).toEqual(threatAreaOf(alice));
      },
    );

    it('opens no turn-end window for a card outside the threat area', () => {
      const { context, state } = newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withInvestigator(alice, { locationId: hall })
        .withCard(hauntingDread, hauntingDreadCard, atLocation(hall))
        .withTurnOf(alice)
        .start();

      const after = stateAfter(context, state, { type: 'EndTurn', investigatorId: alice });

      expect(after.pending).toEqual([]);
    });

    it('discards a card in play at the end of the round, with its tokens', () => {
      const fadingOmen = blankTreachery('fading_omen', {
        abilities: [atEndOfRound(discardSelf())],
      });
      const { context, state } = newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withInvestigator(alice, { locationId: hall })
        .withCard(instanceId('fading_omen'), fadingOmen, atLocation(hall), { tokens: { doom: 1 } })
        .withTurnOf(alice)
        .start();

      const after = stateAfter(context, state, endTurnOfAlice, nextPhase, nextPhase);

      expect(after.cards[instanceId('fading_omen')]).toMatchObject({
        zone: { kind: 'encounterDiscard' },
        tokens: {},
      });
    });

    it('drops a test at the end of the round, which names no investigator', () => {
      const testingOmen = blankTreachery('testing_omen', {
        abilities: [atEndOfRound(skillTest('willpower', 3, { onFail: [takeHorror(1)] }))],
      });
      const { context, state } = newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withInvestigator(alice, { locationId: hall })
        .withCard(instanceId('testing_omen'), testingOmen, atLocation(hall))
        .withTurnOf(alice)
        .start();

      const after = stateAfter(context, state, endTurnOfAlice, nextPhase, nextPhase);

      expect(after.meta.round).toBe(1);
      expect(after.pending).toEqual([]);
    });
  });

  describe('turn-start and phase-end abilities', () => {
    const nextPhase: Command = { type: 'NextPhase' };
    const omen = instanceId('omen');

    it.each([
      { zone: threatAreaOf(alice), where: 'in her threat area', horror: 1 },
      { zone: atLocation(hall), where: 'at her location', horror: 0 },
    ])('deals 1 horror when alice starts her turn with the card $where', ({ zone, horror }) => {
      const gnawingDread = blankTreachery('gnawing_dread', {
        abilities: [whenTurnBegins(takeHorror(1))],
      });
      const { context, state } = newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withInvestigator(alice, { locationId: hall })
        .withCard(instanceId('gnawing_dread'), gnawingDread, zone)
        .start();

      const after = stateAfter(context, state, nextPhase, {
        type: 'StartTurn',
        investigatorId: alice,
      });

      expect(requireInvestigator(after, alice).sanity.horror).toBe(horror);
    });

    it.each(['investigation', 'enemy', 'mythos'] as const)(
      'places doom on the card when the $0 phase ends',
      (phase) => {
        const omenCard = blankTreachery('omen', {
          abilities: [atEndOfPhase(phase, placeDoomOnSelf(1))],
        });
        const { context, state } = newGame()
          .withLocation(hall, blankLocation('hall'), { revealed: true })
          .withInvestigator(alice, { locationId: hall })
          .withCard(omen, omenCard, atLocation(hall))
          .withTurnOf(alice)
          .start();
        let during = stateAfter(context, state, { type: 'EndTurn', investigatorId: alice });
        while (during.meta.phase !== phase) during = stateAfter(context, during, nextPhase);

        const after = stateAfter(context, during, nextPhase);

        expect(during.cards[omen]?.tokens.doom).toBeUndefined();
        expect(after.cards[omen]?.tokens.doom).toBe(1);
      },
    );
  });

  describe("abilities after a basic action's test", () => {
    const ghoul = instanceId('ghoul');
    /**
     * The ghoul has 3 health; after a successful attack on it, 1 doom goes on
     * it, and after a failed one its attacker takes 1 horror.
     */
    const markedGhoulCard = blankEnemy('marked_ghoul', {
      health: fixed(3),
      abilities: [
        afterTest('fight', 'pass', placeDoomOnSelf(1)),
        afterTest('fight', 'fail', takeHorror(1)),
      ],
    });
    /** Alice in the hall, engaged with the marked ghoul, on her turn. */
    const engagedTable = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(ghoul, markedGhoulCard, engagedWith(alice))
      .withTurnOf(alice);

    it.each([
      { name: 'a hit places 1 doom on the enemy', result: 'pass', doom: 1, horror: 0 },
      { name: 'a miss deals alice 1 horror', result: 'fail', doom: undefined, horror: 1 },
    ])('$name', ({ result, doom, horror }) => {
      const { context, state } = engagedTable.start();

      const after = stateAfter(
        context,
        state,
        { type: 'Fight', investigatorId: alice, enemyId: ghoul },
        answer('fight:alice:ghoul', result),
      );

      expect(after.cards[ghoul]?.tokens.doom).toBe(doom);
      expect(requireInvestigator(after, alice).sanity.horror).toBe(horror);
    });

    it('opens no fight window for an evade', () => {
      const { context, state } = engagedTable.start();

      const after = stateAfter(
        context,
        state,
        { type: 'Evade', investigatorId: alice, enemyId: ghoul },
        answer('evade:alice:ghoul', 'pass'),
      );

      expect(after.cards[ghoul]?.tokens.doom).toBeUndefined();
    });

    it('fires for the investigated location and its attachment, before the clue', () => {
      const fog = instanceId('fog');
      const study = instanceId('haunted_study');
      /** A study with 1 clue that deals 1 horror to whoever investigates it successfully. */
      const hauntedStudy = blankLocation('haunted_study', {
        clues: fixed(1),
        abilities: [afterTest('investigate', 'pass', takeHorror(1))],
      });
      const fogCard = blankTreachery('fog', {
        abilities: [afterTest('investigate', 'pass', discardSelf())],
      });
      const { context, state } = newGame()
        .withLocation(study, hauntedStudy, { revealed: true })
        .withInvestigator(alice, { locationId: study })
        .withCard(fog, fogCard, attachedTo(study))
        .withTurnOf(alice)
        .start();
      const asked = stateAfter(context, state, { type: 'Investigate', investigatorId: alice });

      const { state: after, events } = execute(context, asked, answer('investigate:alice', 'pass'));

      expect(requireInvestigator(after, alice)).toMatchObject({ clues: 1, sanity: { horror: 1 } });
      expect(after.cards[fog]?.zone).toEqual({ kind: 'encounterDiscard' });
      const discarded = events.findIndex((e) => e.type === 'CardMoved' && e.cardId === fog);
      const discovered = events.findIndex((e) => e.type === 'CluesDiscovered');
      expect(discarded).toBeLessThan(discovered);
    });
  });

  describe('abilities after an engagement or a clue discovery', () => {
    const lurker = instanceId('lurker');
    const bob = investigatorId('bob');
    /** An enemy that deals 1 horror to whoever it becomes engaged with. */
    const lurkerCard = blankEnemy('lurker', { abilities: [afterEngaging(takeHorror(1))] });

    // Bob is in the hall only when the lurker starts engaged with him, so the spawn needs no choice.
    it.each<{ name: string; zone: Zone; bobInHall: boolean; command: Command }>([
      {
        name: 'spawns engaged with her',
        zone: setAside,
        bobInHall: false,
        command: { type: 'SpawnEnemy', enemyId: lurker, at: hall },
      },
      {
        name: 'is taken over from bob by her',
        zone: engagedWith(bob),
        bobInHall: true,
        command: { type: 'EngageEnemy', enemyId: lurker, investigatorId: alice },
      },
    ])('deals alice 1 horror when the lurker $name', ({ zone, bobInHall, command }) => {
      const { context, state } = newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withInvestigator(alice, { locationId: hall })
        .withInvestigator(bob, bobInHall ? { locationId: hall } : {})
        .withCard(lurker, lurkerCard, zone)
        .withTurnOf(alice)
        .start();

      const after = stateAfter(context, state, command);

      expect(requireInvestigator(after, alice).sanity.horror).toBe(1);
      expect(requireInvestigator(after, bob).sanity.horror).toBe(0);
    });

    it('opens no window for an enemy engaged at setup', () => {
      const { state } = newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withInvestigator(alice, { locationId: hall })
        .withCard(lurker, lurkerCard, atLocation(hall))
        .start();

      expect(state.cards[lurker]?.zone).toEqual(engagedWith(alice));
      expect(requireInvestigator(state, alice).sanity.horror).toBe(0);
    });

    it('places 1 doom on the location alice discovers a clue at', () => {
      const shrine = instanceId('shrine');
      /** A shrine with 2 clues; after a clue is discovered there, 1 doom goes on it. */
      const shrineCard = blankLocation('shrine', {
        clues: fixed(2),
        abilities: [afterDiscoveringClues(placeDoomOnSelf(1))],
      });
      const { context, state } = newGame()
        .withLocation(shrine, shrineCard, { revealed: true })
        .withInvestigator(alice, { locationId: shrine })
        .withTurnOf(alice)
        .start();

      const after = stateAfter(
        context,
        state,
        { type: 'Investigate', investigatorId: alice },
        answer('investigate:alice', 'pass'),
      );

      expect(after.cards[shrine]?.tokens).toEqual({ clue: 1, doom: 1 });
    });
  });

  describe('abilities after an enemy attack', () => {
    const ghast = instanceId('ghast');
    /** An enemy whose attack deals 1 damage, and 1 horror after it. */
    const ghastCard = blankEnemy('ghast', {
      damage: 1,
      abilities: [afterAttacking(takeHorror(1))],
    });

    it.each<{ name: string; commands: Command[] }>([
      {
        name: 'in the enemy phase',
        commands: [
          { type: 'EndTurn', investigatorId: alice },
          { type: 'NextPhase' },
          { type: 'ResolveEnemyAttack', enemyId: ghast, investigatorId: alice },
        ],
      },
      {
        name: 'outside it (an attack of opportunity)',
        commands: [
          { type: 'DealEnemyAttack', enemyId: ghast, investigatorId: alice, damage: 1, horror: 0 },
        ],
      },
    ])('deals alice 1 horror after the ghast attacks her $name', ({ commands }) => {
      const { context, state } = newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withInvestigator(alice, { locationId: hall })
        .withCard(ghast, ghastCard, engagedWith(alice))
        .withTurnOf(alice)
        .start();

      const after = stateAfter(context, state, ...commands);

      expect(requireInvestigator(after, alice).health.damage).toBe(1);
      expect(requireInvestigator(after, alice).sanity.horror).toBe(1);
    });

    it('exhausts the ghast in the enemy phase only after its ability has resolved', () => {
      const { context, state } = newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withInvestigator(alice, { locationId: hall })
        .withCard(ghast, ghastCard, engagedWith(alice))
        .withTurnOf(alice)
        .start();
      const enemyPhase = stateAfter(
        context,
        state,
        { type: 'EndTurn', investigatorId: alice },
        { type: 'NextPhase' },
      );

      const { events } = execute(context, enemyPhase, {
        type: 'ResolveEnemyAttack',
        enemyId: ghast,
        investigatorId: alice,
      });

      expect(events.map((event) => event.type)).toEqual([
        'PhaseStepsChanged',
        'InvestigatorChanged', // the attack's damage
        'EnemyAttacked',
        'InvestigatorChanged', // the ability's horror
        'ExhaustChanged',
      ]);
    });

    it('drops the ability for an investigator the attack defeated', () => {
      const { context, state } = newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withInvestigator(alice, { locationId: hall, health: { max: 1, damage: 0 } })
        .withCard(ghast, ghastCard, engagedWith(alice))
        .withTurnOf(alice)
        .start();

      const after = stateAfter(context, state, {
        type: 'DealEnemyAttack',
        enemyId: ghast,
        investigatorId: alice,
        damage: 1,
        horror: 0,
      });

      expect(requireInvestigator(after, alice).status).not.toBe('active');
      expect(requireInvestigator(after, alice).sanity.horror).toBe(0);
    });
  });

  describe('abilities when an enemy is defeated', () => {
    const wailingSpawn = instanceId('wailing_spawn');
    const bob = investigatorId('bob');
    const carol = investigatorId('carol');
    const cellar = instanceId('cellar');
    /**
     * "When this enemy is defeated: each investigator at this location takes 1 horror" (like Goat
     * Spawn). Aloof, so it can start unengaged in the hall.
     */
    const wailingSpawnCard = blankEnemy('wailing_spawn', {
      keywords: [{ name: 'aloof' }],
      abilities: [whenDefeated(takeHorror(1, eachInvestigatorAt(itsLocation())))],
    });

    // Alice and bob are in the hall with the wailing spawn, carol is in the cellar.
    it.each<{ name: string; zone: Zone; command: Command }>([
      {
        name: 'unengaged, by a card effect',
        zone: atLocation(hall),
        command: { type: 'DefeatEnemy', enemyId: wailingSpawn },
      },
      {
        name: 'engaged with alice, by damage',
        zone: engagedWith(alice),
        command: { type: 'DamageEnemy', enemyId: wailingSpawn, amount: 1 },
      },
    ])(
      'deals 1 horror to each investigator in the hall when it is defeated $name',
      ({ zone, command }) => {
        const { context, state } = newGame()
          .withLocation(hall, blankLocation('hall'), { revealed: true })
          .withLocation(cellar, blankLocation('cellar'), { revealed: true })
          .withInvestigator(alice, { locationId: hall })
          .withInvestigator(bob, { locationId: hall })
          .withInvestigator(carol, { locationId: cellar })
          .withCard(wailingSpawn, wailingSpawnCard, zone)
          .withTurnOf(alice)
          .start();

        const after = stateAfter(context, state, command);

        expect(after.cards[wailingSpawn]?.zone).toEqual({ kind: 'encounterDiscard' });
        expect(requireInvestigator(after, alice).sanity.horror).toBe(1);
        expect(requireInvestigator(after, bob).sanity.horror).toBe(1);
        expect(requireInvestigator(after, carol).sanity.horror).toBe(0);
      },
    );
  });

  describe('tests that cost something for each point failed', () => {
    const graspingHands = instanceId('grasping_hands');
    const rottingRemains = instanceId('rotting_remains');
    /** "Revelation – Test agility (3). Take 1 damage for each point you fail by." */
    const graspingHandsCard = blankTreachery('grasping_hands', {
      abilities: [whenRevealed(skillTest('agility', 3, { perPointFailed: 'damage' }))],
    });
    /** "Revelation – Test willpower (3). Take 1 horror for each point you fail by." */
    const rottingRemainsCard = blankTreachery('rotting_remains', {
      abilities: [whenRevealed(skillTest('willpower', 3, { perPointFailed: 'horror' }))],
    });
    /** Alice in the hall, with Grasping Hands on top of the encounter deck and Rotting Remains below. */
    const treacheryTable = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(graspingHands, graspingHandsCard, { kind: 'encounterDeck' })
      .withCard(rottingRemains, rottingRemainsCard, { kind: 'encounterDeck' });
    const aliceDraws: Command = { type: 'DrawEncounter', investigatorId: alice };

    it.each([
      { case: 'a fail with no margin, the default 1,', answered: undefined, damage: 1 },
      { case: 'a fail by 3', answered: 3, damage: 3 },
      { case: 'a fail by 0', answered: 0, damage: 0 },
    ])('$case deals $damage damage', ({ answered, damage }) => {
      const { context, state: started } = treacheryTable.start();
      const drawn = stateAfter(context, started, aliceDraws);

      const { state, events } = execute(context, drawn, {
        ...answer('test:grasping_hands', 'fail'),
        ...(answered === undefined ? {} : { margin: answered }),
      });

      expect(state.investigators.find((inv) => inv.id === alice)?.health.damage).toBe(damage);
      expect(events.find((event) => event.type === 'SkillTestResolved')).toMatchObject({
        outcome: 'fail',
        margin: damage,
      });
    });

    it('deals horror for a card that names it', () => {
      const { context, state: started } = treacheryTable.start();
      const secondDraw = stateAfter(
        context,
        started,
        aliceDraws,
        answer('test:grasping_hands', 'pass'),
        aliceDraws,
      );

      const { state } = execute(context, secondDraw, {
        ...answer('test:rotting_remains', 'fail'),
        margin: 2,
      });

      expect(state.investigators.find((inv) => inv.id === alice)?.sanity.horror).toBe(2);
    });

    it('deals nothing on a pass', () => {
      const { context, state: started } = treacheryTable.start();
      const drawn = stateAfter(context, started, aliceDraws);

      const { state } = execute(context, drawn, answer('test:grasping_hands', 'pass'));

      expect(state.investigators.find((inv) => inv.id === alice)?.health.damage).toBe(0);
    });

    it.each([
      { clues: 3, margin: 2, kept: 1, placed: 2 },
      { clues: 1, margin: 3, kept: 0, placed: 1 },
    ])(
      "places $placed of alice's $clues clues on the hall for a fail by $margin",
      ({ clues, margin, kept, placed }) => {
        /** "Revelation – Test intellect (4). For each point you fail by, place 1 of your clues on your location." */
        const losingTrailCard = blankTreachery('losing_trail', {
          abilities: [whenRevealed(skillTest('intellect', 4, { perPointFailed: 'clues' }))],
        });
        const { context, state: started } = newGame()
          .withLocation(hall, blankLocation('hall'), { revealed: true, clues: 0 })
          .withInvestigator(alice, { locationId: hall, clues })
          .withCard(instanceId('losing_trail'), losingTrailCard, { kind: 'encounterDeck' })
          .start();
        const drawn = stateAfter(context, started, aliceDraws);

        const { state } = execute(context, drawn, {
          ...answer('test:losing_trail', 'fail'),
          margin,
        });

        expect(requireInvestigator(state, alice).clues).toBe(kept);
        expect(state.cards[hall]?.tokens.clue).toBe(placed);
      },
    );
  });

  describe('reverse-side abilities', () => {
    const priest = instanceId('priest');
    const priestCard = blankEnemy('priest');
    const lantern = instanceId('lantern');
    /** The reverse side of last_stand_act: reveal the cellar, then the set-aside priest spawns there. */
    const lastStandAct = blankAct('last_stand_act', {
      abilities: [
        whenAdvanced(
          revealLocation(onlyCopy(cardCode('cellar'))),
          spawnEnemyAt(onlyCopy(cardCode('priest')), onlyCopy(cardCode('cellar'))),
        ),
      ],
    });

    it('places doom on the advancing agenda, which is still current', () => {
      const doomedAgenda = blankAgenda('doomed_agenda', fixed(3), {
        abilities: [whenAdvanced(placeDoomOnAgenda(1))],
      });
      const { context, state: started } = newGame()
        .withAgenda(agenda1, doomedAgenda)
        .withAgenda(agenda2, secondAgendaCard)
        .start();

      const { state } = execute(context, started, { type: 'AdvanceAgenda' });

      // The advanced agenda has left the game since, keeping the doom it got while current.
      expect(state.cards[agenda1]?.tokens.doom).toBe(1);
      expect(state.cards[agenda2]?.tokens.doom).toBeUndefined();
      expect(state.agenda.current).toBe(agenda2);
    });

    it('reveals a location and spawns a set-aside enemy there, each named by its code', () => {
      const { context, state: started } = newGame()
        .withAct(act1, lastStandAct)
        .withAct(act2, secondActCard)
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withLocation(cellar, blankLocation('cellar'))
        .withCard(priest, priestCard, { kind: 'setAside' })
        .withInvestigator(alice, { locationId: hall })
        .start();

      const { state } = execute(context, started, { type: 'AdvanceAct' });

      expect(state.cards[cellar]?.faceUp).toBe(true);
      expect(state.cards[priest]?.zone).toEqual(atLocation(cellar));
      expect(state.act.current).toBe(act2);
    });

    it('puts a set-aside card into play at a location', () => {
      const lanternAct = blankAct('lantern_act', {
        abilities: [
          whenAdvanced(putSetAsideIntoPlay(cardCode('lantern'), onlyCopy(cardCode('hall')))),
        ],
      });
      const { context, state: started } = newGame()
        .withAct(act1, lanternAct)
        .withAct(act2, secondActCard)
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withCard(lantern, blankAsset('lantern'), { kind: 'setAside' })
        .start();

      const { state } = execute(context, started, { type: 'AdvanceAct' });

      expect(state.cards[lantern]?.zone).toEqual(atLocation(hall));
    });

    /** What `lastStandAct` records when the priest it spawns is not in the game exactly once. */
    const priestSpawnSkipped = {
      type: 'AbilityEffectSkipped',
      cardId: act1,
      effect: 'SpawnEnemy',
      missing: [cardCode('priest')],
    };

    it('skips an effect naming a code the game lacks and records it for the players', () => {
      const { context, state: started } = newGame()
        .withAct(act1, lastStandAct)
        .withAct(act2, secondActCard)
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withLocation(cellar, blankLocation('cellar'))
        .start();

      const { events, state } = execute(context, started, { type: 'AdvanceAct' });

      expect(state.cards[cellar]?.faceUp).toBe(true);
      expect(events.filter((event) => event.type === 'AbilityEffectSkipped')).toEqual([
        priestSpawnSkipped,
      ]);
      expect(state.act.current).toBe(act2);
    });

    it('skips an effect naming a code the game holds twice and records it for the players', () => {
      const { context, state: started } = newGame()
        .withAct(act1, lastStandAct)
        .withAct(act2, secondActCard)
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withLocation(cellar, blankLocation('cellar'))
        .withCard(priest, priestCard, { kind: 'setAside' })
        .withCard(instanceId('second_priest'), priestCard, { kind: 'setAside' })
        .start();

      const { events, state } = execute(context, started, { type: 'AdvanceAct' });

      expect(state.cards[priest]?.zone).toEqual({ kind: 'setAside' });
      expect(events.filter((event) => event.type === 'AbilityEffectSkipped')).toEqual([
        priestSpawnSkipped,
      ]);
    });
  });

  describe('reverse sides that open a new area', () => {
    const attic = instanceId('attic');
    const atticCard = blankLocation('attic');
    const bob = investigatorId('bob');
    const lantern = instanceId('lantern');
    const aloofGhoul = instanceId('aloof_ghoul');
    const hallCard = blankLocation('hall');
    /** Aloof, so it waits in the hall without engaging anyone. */
    const aloofGhoulCard = blankEnemy('aloof_ghoul', { keywords: [{ name: 'aloof' }] });
    /** The attic as a map of its own, the way a scenario declares an area set aside at setup. */
    const atticStep: AddMapStep = {
      kind: 'addMap',
      mapId: mapId('upstairs'),
      name: 'Upstairs',
      locations: [{ code: cardCode('attic'), at: { column: 0, row: 0 } }],
    };
    /**
     * The reverse side of moving_act: the attic's map comes into play, the enemies in the hall
     * are discarded, each investigator moves to the attic, and the hall leaves the game.
     */
    const movingAct = blankAct('moving_act', {
      abilities: [
        whenAdvanced(
          ...putMapIntoPlay(atticStep),
          discardEachEnemyAt(onlyCopy(cardCode('hall'))),
          moveEachInvestigatorTo(onlyCopy(cardCode('attic'))),
          removeFromGame(onlyCopy(cardCode('hall'))),
        ),
      ],
    });
    /**
     * Alice and bob in the hall, with an aloof ghoul at the hall, a ghoul engaged with bob and one
     * in the cellar next door; a lantern lies in the hall. The attic is set aside.
     */
    const movingTable = newGame()
      .withAct(act1, movingAct)
      .withAct(act2, secondActCard)
      .withLocation(hall, hallCard, { revealed: true })
      .withLocation(cellar, blankLocation('cellar'), { revealed: true })
      .withConnection(hall, cellar)
      .withCard(attic, atticCard, { kind: 'setAside' })
      .withInvestigator(alice, { locationId: hall })
      .withInvestigator(bob, { locationId: hall })
      .withCard(aloofGhoul, aloofGhoulCard, atLocation(hall), { faceUp: true })
      .withCard(instanceId('bobs_ghoul'), ghoulCard, { kind: 'engaged', investigatorId: bob })
      .withCard(instanceId('cellar_ghoul'), ghoulCard, atLocation(cellar), { faceUp: true })
      .withCard(lantern, blankAsset('lantern'), atLocation(hall));

    it('puts the set-aside area into play as a map of its own', () => {
      const { context, state: started } = movingTable.start();

      const { state } = execute(context, started, { type: 'AdvanceAct' });

      expect(state.board.maps[mapId('upstairs')]?.name).toBe('Upstairs');
      expect(state.cards[attic]?.zone).toEqual({ kind: 'location', mapId: mapId('upstairs') });
      expect(state.board.maps[mapId('upstairs')]?.layout).toEqual({
        [attic]: { column: 0, row: 0 },
      });
      expect(checkInvariants(state)).toEqual([]);
    });

    it('writes a map step as an AddMap of the only copies, then a reveal per face-up location', () => {
      const landing = cardCode('landing');
      const step: AddMapStep = {
        kind: 'addMap',
        mapId: mapId('upstairs'),
        name: 'Upstairs',
        locations: [
          { code: landing, faceUp: true },
          { code: cardCode('attic'), at: { column: 1, row: 0 } },
        ],
        connections: [{ from: landing, to: cardCode('attic') }],
      };

      expect(putMapIntoPlay(step)).toEqual([
        {
          type: 'AddMap',
          mapId: mapId('upstairs'),
          map: {
            name: 'Upstairs',
            visible: true,
            connections: [
              { from: onlyCopy(landing), to: onlyCopy(cardCode('attic')), oneWay: false },
            ],
          },
          locations: [
            { id: onlyCopy(landing), at: undefined },
            { id: onlyCopy(cardCode('attic')), at: { column: 1, row: 0 } },
          ],
        },
        { type: 'RevealLocation', locationId: onlyCopy(landing) },
      ]);
    });

    it('discards each enemy in the hall, the engaged one too, but no other card there', () => {
      const { context, state: started } = movingTable.start();

      const { state } = execute(context, started, { type: 'AdvanceAct' });

      expect(state.cards[aloofGhoul]?.zone).toEqual({ kind: 'encounterDiscard' });
      expect(state.cards[instanceId('bobs_ghoul')]?.zone).toEqual({ kind: 'encounterDiscard' });
      expect(state.cards[instanceId('cellar_ghoul')]?.zone).toEqual(atLocation(cellar));
      expect(state.cards[lantern]?.zone).toEqual(atLocation(hall));
    });

    it('moves each investigator to the attic and removes the hall from the game', () => {
      const { context, state: started } = movingTable.start();

      const { state } = execute(context, started, { type: 'AdvanceAct' });

      expect(state.investigators.map((inv) => [inv.id, inv.locationId])).toEqual([
        [alice, attic],
        [bob, attic],
      ]);
      expect(state.cards[hall]?.zone).toEqual({ kind: 'outOfGame' });
    });

    it('moves each investigator in player order, starting with the lead', () => {
      const { context, state: started } = movingTable.start();
      const bobLeads = { ...started, meta: { ...started.meta, leadInvestigator: bob } };

      const { events } = execute(context, bobLeads, { type: 'AdvanceAct' });

      expect(
        events.flatMap((event) =>
          event.type === 'InvestigatorMoved' ? [event.investigatorId] : [],
        ),
      ).toEqual([bob, alice]);
    });

    it('leaves a defeated investigator where they were', () => {
      const carol = investigatorId('carol');
      const { context, state: started } = movingTable
        .withInvestigator(carol, { locationId: hall, status: 'defeated' })
        .start();

      const { state } = execute(context, started, { type: 'AdvanceAct' });

      expect(state.investigators.find((inv) => inv.id === carol)?.locationId).toBe(hall);
    });

    it('skips discarding the enemies when the location they are at is not there exactly once', () => {
      const { context, state: started } = movingTable
        .withCard(instanceId('second_hall'), hallCard, { kind: 'setAside' })
        .start();

      const { events, state } = execute(context, started, { type: 'AdvanceAct' });

      expect(state.cards[aloofGhoul]?.zone).toEqual(atLocation(hall));
      expect(events.filter((event) => event.type === 'AbilityEffectSkipped')).toContainEqual({
        type: 'AbilityEffectSkipped',
        cardId: act1,
        effect: 'DiscardCard',
        missing: [cardCode('hall')],
      });
    });

    it('skips the map when the game holds one of its locations twice', () => {
      const { context, state: started } = movingTable
        .withCard(instanceId('second_attic'), atticCard, { kind: 'setAside' })
        .start();

      const { events, state } = execute(context, started, { type: 'AdvanceAct' });

      expect(state.board.maps[mapId('upstairs')]).toBeUndefined();
      expect(events.filter((event) => event.type === 'AbilityEffectSkipped')).toContainEqual({
        type: 'AbilityEffectSkipped',
        cardId: act1,
        effect: 'AddMap',
        missing: [cardCode('attic')],
      });
    });
  });

  describe('reverse sides that draw for the lead investigator', () => {
    const bob = investigatorId('bob');
    const topTreachery = instanceId('top_treachery');
    const hiddenGhoul = instanceId('hidden_ghoul');
    const hiddenGhoulCard = blankEnemy('hidden_ghoul');
    /** "Shuffle the encounter discard pile into the deck, then discard until an enemy is discarded; the lead draws it." */
    const drawingAct = blankAct('drawing_act', {
      abilities: [
        whenAdvanced(shuffleEncounterDiscard(), leadDrawsDiscardingUntil({ typeCode: 'enemy' })),
      ],
    });
    /** Alice and bob in the hall; alice leads unless a test makes bob the lead. */
    const drawingTable = newGame()
      .withAct(act1, drawingAct)
      .withAct(act2, secondActCard)
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withInvestigator(bob, { locationId: hall });

    it('makes the lead draw the first enemy, the cards above it discarded', () => {
      const { context, state: started } = drawingTable
        .withCard(topTreachery, blankTreachery('top_treachery'), { kind: 'encounterDeck' })
        .withCard(hiddenGhoul, hiddenGhoulCard, { kind: 'encounterDeck' })
        // A card below keeps the deck from running out, which would shuffle the discard back in.
        .withCard(instanceId('bottom_treachery'), blankTreachery('bottom_treachery'), {
          kind: 'encounterDeck',
        })
        .start();
      const bobLeads = { ...started, meta: { ...started.meta, leadInvestigator: bob } };

      const { state } = execute(context, bobLeads, { type: 'AdvanceAct' });

      expect(state.cards[hiddenGhoul]?.zone).toEqual({ kind: 'engaged', investigatorId: bob });
      expect(state.cards[topTreachery]?.zone).toEqual({ kind: 'encounterDiscard' });
    });

    it('shuffles the discard in first, so an enemy discarded earlier can be drawn', () => {
      const { context, state: started } = drawingTable
        .withCard(hiddenGhoul, hiddenGhoulCard, { kind: 'encounterDiscard' })
        .start();
      const bobLeads = { ...started, meta: { ...started.meta, leadInvestigator: bob } };

      const { state } = execute(context, bobLeads, { type: 'AdvanceAct' });

      expect(state.cards[hiddenGhoul]?.zone).toEqual({ kind: 'engaged', investigatorId: bob });
    });

    it('draws nothing once the lead has left the scenario', () => {
      const { context, state: started } = drawingTable
        .withCard(hiddenGhoul, hiddenGhoulCard, { kind: 'encounterDeck' })
        .withCard(instanceId('bottom_treachery'), blankTreachery('bottom_treachery'), {
          kind: 'encounterDeck',
        })
        .withInvestigator(investigatorId('carol'), { status: 'defeated' })
        .start();
      const carolLeftAsLead = {
        ...started,
        meta: { ...started.meta, leadInvestigator: investigatorId('carol') },
      };

      const { state } = execute(context, carolLeftAsLead, { type: 'AdvanceAct' });

      expect(state.cards[hiddenGhoul]?.zone).toEqual({ kind: 'encounterDeck' });
    });

    it('draws and discards nothing when no enemy is left', () => {
      const { context, state: started } = drawingTable
        .withCard(topTreachery, blankTreachery('top_treachery'), { kind: 'encounterDeck' })
        .start();

      const { state } = execute(context, started, { type: 'AdvanceAct' });

      expect(state.cards[topTreachery]?.zone).toEqual({ kind: 'encounterDeck' });
      expect(state.act.current).toBe(act2);
    });
  });

  it('resolves the forced effects a forced effect triggers within the same command', () => {
    /** The cellar's revelation places 1 doom on the agenda; the first act's reverse side reveals it. */
    const doomingCellar = blankLocation('cellar', {
      clues: perInvestigator(2),
      abilities: [whenRevealed(placeDoomOnAgenda(1))],
    });
    const revealingAct = blankAct('revealing_act', {
      abilities: [whenAdvanced(revealLocation(onlyCopy(cardCode('cellar'))))],
    });
    const { context, state: started } = newGame()
      .withAgenda(agenda1, firstAgendaCard)
      .withAct(act1, revealingAct)
      .withAct(act2, secondActCard)
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(cellar, doomingCellar)
      .withInvestigator(alice, { locationId: hall })
      .start();

    const { state } = execute(context, started, { type: 'AdvanceAct' });

    expect(state.cards[cellar]?.faceUp).toBe(true);
    expect(state.cards[agenda1]?.tokens.doom).toBe(1);
  });
});

describe('objectives on the current agenda and act', () => {
  const priest = instanceId('priest');
  const cultist = instanceId('cultist');
  const priestCard = blankEnemy('priest');
  /** "If the priest is defeated, advance." */
  const priestObjectiveAct = blankAct('priest_objective_act', {
    abilities: [whenEnemyDefeated(priestCard.code, advanceAct())],
  });
  /** "If the priest is defeated, place 1 doom on the agenda." */
  const priestObjectiveAgenda = blankAgenda('priest_objective_agenda', fixed(3), {
    abilities: [whenEnemyDefeated(priestCard.code, placeDoomOnAgenda(1))],
  });
  /** Alice in the hall with the priest and a cultist; the current act has the priest objective. */
  const objectiveTable = newGame()
    .withAgenda(agenda1, firstAgendaCard)
    .withAct(act1, priestObjectiveAct)
    .withAct(act2, secondActCard)
    .withLocation(hall, blankLocation('hall'), { revealed: true })
    .withCard(priest, priestCard, atLocation(hall), { faceUp: true })
    .withCard(cultist, blankEnemy('cultist'), atLocation(hall), { faceUp: true })
    .withInvestigator(alice, { locationId: hall });

  it('advances the current act when the enemy it names is defeated', () => {
    const { context, state: started } = objectiveTable.start();

    const { state } = execute(context, started, { type: 'DefeatEnemy', enemyId: priest });

    expect(state.act.current).toBe(act2);
  });

  it('does nothing when another enemy is defeated', () => {
    const { context, state: started } = objectiveTable.start();

    const { state } = execute(context, started, { type: 'DefeatEnemy', enemyId: cultist });

    expect(state.act.current).toBe(act1);
  });

  it('fires for the current agenda too', () => {
    const { context, state: started } = newGame()
      .withAgenda(agenda1, priestObjectiveAgenda)
      .withAct(act1, firstActCard)
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withCard(priest, priestCard, atLocation(hall), { faceUp: true })
      .withInvestigator(alice, { locationId: hall })
      .start();

    const { state } = execute(context, started, { type: 'DefeatEnemy', enemyId: priest });

    expect(state.cards[agenda1]?.tokens.doom).toBe(1);
  });

  it('does not fire for an act that is not current yet', () => {
    const { context, state: started } = newGame()
      .withAgenda(agenda1, firstAgendaCard)
      .withAct(act1, firstActCard)
      .withAct(act2, priestObjectiveAct)
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withCard(priest, priestCard, atLocation(hall), { faceUp: true })
      .withInvestigator(alice, { locationId: hall })
      .start();

    const { state } = execute(context, started, { type: 'DefeatEnemy', enemyId: priest });

    expect(state.act.current).toBe(act1);
  });
});

describe('abilities with a condition on the current act', () => {
  const bob = investigatorId('bob');
  const trappedAct = blankAct('trapped_act');
  const finalAct = blankAct('final_act');
  /** "If it is the trapped act, (→R3)." */
  const trappedAgenda = blankAgenda('trapped_agenda', fixed(3), {
    abilities: [duringAct([trappedAct.code], whenAdvanced(endScenario(resolutionId('R3'))))],
  });
  /** Alice and bob in the hall, with the trapped agenda current. */
  const trappedTable = newGame()
    .withAgenda(agenda1, trappedAgenda)
    .withAgenda(agenda2, secondAgendaCard)
    .withLocation(hall, blankLocation('hall'), { revealed: true })
    .withInvestigator(alice, { locationId: hall })
    .withInvestigator(bob, { locationId: hall });

  it('fires while its act is current', () => {
    const { context, state: started } = trappedTable.withAct(act1, trappedAct).start();

    const { state } = execute(context, started, { type: 'AdvanceAgenda' });

    expect(state.meta).toMatchObject({ ended: true, resolution: resolutionId('R3') });
  });

  it('does not fire while another act is current', () => {
    const { context, state: started } = trappedTable.withAct(act1, finalAct).start();

    const { state } = execute(context, started, { type: 'AdvanceAgenda' });

    expect(state.meta.ended).toBeUndefined();
    expect(state.agenda.current).toBe(agenda2);
  });
});

describe('a choice for the lead investigator', () => {
  const bob = investigatorId('bob');
  /** "The lead investigator must decide: burn the house (→R1), or leave it standing and take 1 horror." */
  const finalAct = blankAct('final_act', {
    abilities: [
      whenAdvanced(
        leadDecides(decisionId('burn_or_spare'), 'Burn the house?', [
          { id: 'burn', label: 'Burn it', effects: [endScenario(resolutionId('R1'))] },
          {
            id: 'spare',
            label: 'Leave it',
            effects: [
              {
                type: 'AdjustInvestigator',
                investigatorId: { ref: 'lead' },
                stat: 'horror',
                delta: 1,
              },
            ],
          },
        ]),
      ),
    ],
  });
  /** Alice, the lead, and bob in the hall, with the final act current. */
  const finalTable = newGame()
    .withAct(act1, finalAct)
    .withAct(act2, secondActCard)
    .withLocation(hall, blankLocation('hall'), { revealed: true })
    .withInvestigator(alice, { locationId: hall })
    .withInvestigator(bob, { locationId: hall });

  it('asks the lead once the card has advanced', () => {
    const { context, state: started } = finalTable.start();

    const { state } = execute(context, started, { type: 'AdvanceAct' });

    expect(state.pending).toMatchObject([
      {
        id: decisionId('burn_or_spare'),
        prompt: 'Burn the house?',
        decider: { kind: 'lead' },
        options: [{ id: 'burn' }, { id: 'spare' }],
      },
    ]);
  });

  it.each([
    { optionId: 'burn', ended: true, aliceHorror: 0 },
    { optionId: 'spare', ended: undefined, aliceHorror: 1 },
  ])('runs the effects of the answer $optionId', ({ optionId, ended, aliceHorror }) => {
    const { context, state: started } = finalTable.start();
    const asked = stateAfter(context, started, { type: 'AdvanceAct' });

    const state = stateAfter(context, asked, answer('burn_or_spare', optionId));

    expect(state.meta.ended).toBe(ended);
    expect(state.investigators.find((inv) => inv.id === alice)?.sanity.horror).toBe(aliceHorror);
    expect(state.pending).toEqual([]);
  });
});

describe('a choice for the investigator who drew the card', () => {
  const bob = investigatorId('bob');
  const offer = instanceId('offer');
  /**
   * The drawer chooses: draw 2 and 2 doom, or 2 horror (like Offer of Power). The draw is done at
   * the table, so its option only places the doom.
   */
  const offerCard = blankTreachery('offer', {
    abilities: [
      whenRevealed(
        youMustEither(decisionId('offer'), 'Draw or take horror?', [
          { id: 'draw', label: 'Draw 2 cards, 2 doom', effects: [placeDoomOnAgenda(2)] },
          { id: 'horror', label: 'Take 2 horror', effects: [takeHorror(2)] },
        ]),
      ),
    ],
  });
  /** Alice, the lead, and bob in the hall; bob draws the offer. */
  const offerTable = newGame()
    .withAgenda(agenda1, firstAgendaCard)
    .withLocation(hall, blankLocation('hall'), { revealed: true })
    .withInvestigator(alice, { locationId: hall })
    .withInvestigator(bob, { locationId: hall })
    .withCard(offer, offerCard, { kind: 'encounterDeck' });
  const bobDraws: Command = { type: 'DrawEncounter', investigatorId: bob };

  it('asks the drawer, not the lead', () => {
    const { context, state: started } = offerTable.start();

    const { state } = execute(context, started, bobDraws);

    expect(state.pending).toMatchObject([
      {
        id: decisionId('offer'),
        decider: { kind: 'investigator', investigatorId: bob },
        options: [{ id: 'draw' }, { id: 'horror' }],
      },
    ]);
  });

  it.each([
    { optionId: 'draw', agendaDoom: 2, bobHorror: 0 },
    { optionId: 'horror', agendaDoom: undefined, bobHorror: 2 },
  ])('runs the effects of the answer $optionId', ({ optionId, agendaDoom, bobHorror }) => {
    const { context, state: started } = offerTable.start();
    const asked = stateAfter(context, started, bobDraws);

    const state = stateAfter(context, asked, answer('offer', optionId));

    expect(state.cards[agenda1]?.tokens.doom).toBe(agendaDoom);
    expect(requireInvestigator(state, bob).sanity.horror).toBe(bobHorror);
    expect(requireInvestigator(state, alice).sanity.horror).toBe(0);
  });
});

describe('a choice without the options that cannot be resolved', () => {
  const shadow = instanceId('shadow');
  /** The drawer must either spend 1 clue or take 2 damage (like Hunting Shadow). */
  const shadowCard = blankTreachery('shadow', {
    abilities: [
      whenRevealed(
        youMustEither(decisionId('shadow'), 'Spend a clue or take damage?', [
          { id: 'clue', label: 'Spend 1 clue', effects: [spendClues(1)] },
          { id: 'damage', label: 'Take 2 damage', effects: [takeDamage(2)] },
        ]),
      ),
    ],
  });

  it.each([
    { clues: 1, options: [{ id: 'clue' }, { id: 'damage' }] },
    { clues: 0, options: [{ id: 'damage' }] },
  ])(
    'offers alice with $clues clues only the options that can be resolved',
    ({ clues, options }) => {
      const { context, state: started } = newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withInvestigator(alice, { locationId: hall, clues })
        .withCard(shadow, shadowCard, { kind: 'encounterDeck' })
        .start();

      const { state } = execute(context, started, { type: 'DrawEncounter', investigatorId: alice });

      expect(state.pending).toMatchObject([{ id: decisionId('shadow'), options }]);
    },
  );

  it('asks nothing when alice can resolve no option', () => {
    const drained = instanceId('drained');
    /** "You must either spend 1 clue or spend 1 resource." */
    const drainedCard = blankTreachery('drained', {
      abilities: [
        whenRevealed(
          youMustEither(decisionId('drained'), 'Spend a clue or a resource?', [
            { id: 'clue', label: 'Spend 1 clue', effects: [spendClues(1)] },
            {
              id: 'resource',
              label: 'Spend 1 resource',
              effects: [
                {
                  type: 'AdjustInvestigator',
                  investigatorId: { ref: 'windowInvestigator' },
                  stat: 'resources',
                  delta: -1,
                },
              ],
            },
          ]),
        ),
      ],
    });
    const { context, state: started } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall, clues: 0, resources: 0 })
      .withCard(drained, drainedCard, { kind: 'encounterDeck' })
      .start();

    const state = stateAfter(context, started, { type: 'DrawEncounter', investigatorId: alice });

    expect(state.pending).toEqual([]);
    expect(requireInvestigator(state, alice)).toMatchObject({ clues: 0, resources: 0 });
  });

  it('spends the clue alice chose to spend', () => {
    const { context, state: started } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall, clues: 1 })
      .withCard(shadow, shadowCard, { kind: 'encounterDeck' })
      .start();
    const asked = stateAfter(context, started, { type: 'DrawEncounter', investigatorId: alice });

    const state = stateAfter(context, asked, answer('shadow', 'clue'));

    expect(requireInvestigator(state, alice)).toMatchObject({ clues: 0, health: { damage: 0 } });
  });

  it('asks with all options after a failed test on entering, as the graveyard does', () => {
    const graveyard = instanceId('graveyard');
    const rivertown = instanceId('rivertown');
    /** "After you enter: test willpower (3); if you fail, you must either take 2 horror or move to Rivertown." */
    const graveyardCard = blankLocation('graveyard', {
      abilities: [
        afterEntering(
          skillTest('willpower', 3, {
            onFail: [
              youMustEither(decisionId('graveyard'), 'Horror or Rivertown?', [
                { id: 'horror', label: 'Take 2 horror', effects: [takeHorror(2)] },
                {
                  id: 'move',
                  label: 'Move to Rivertown',
                  effects: [moveTo(onlyCopy(cardCode('rivertown')))],
                },
              ]),
            ],
          }),
        ),
      ],
    });
    const { context, state: started } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(graveyard, graveyardCard, { revealed: true })
      .withLocation(rivertown, blankLocation('rivertown'), { revealed: true })
      .withConnection(hall, graveyard)
      .withInvestigator(alice, { locationId: hall })
      .withTurnOf(alice)
      .start();
    const failed = stateAfter(
      context,
      started,
      { type: 'MoveInvestigator', investigatorId: alice, to: graveyard },
      answer('test:graveyard', 'fail'),
    );

    const state = stateAfter(context, failed, answer('graveyard', 'move'));

    expect(requireInvestigator(state, alice)).toMatchObject({
      locationId: rivertown,
      sanity: { horror: 0 },
    });
  });
});

describe('a card that gains surge without clues', () => {
  const falseTrail = instanceId('false_trail');
  const nextCard = instanceId('next_card');
  /** "If you have no clues, it gains surge. If you have 1 or more clues, test intellect (4)." */
  const falseTrailCard = blankTreachery('false_trail', {
    abilities: [
      ifYouHave('clues', { max: 0 }, whenRevealed(gainSurge())),
      ifYouHave('clues', { min: 1 }, whenRevealed(skillTest('intellect', 4))),
    ],
  });

  it.each([
    { clues: 0, drawn: [falseTrail, nextCard], pending: [] },
    { clues: 1, drawn: [falseTrail], pending: [{ id: decisionId('test:false_trail') }] },
  ])('draws $drawn for alice with $clues clues', ({ clues, drawn, pending }) => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall, clues })
      .withCard(falseTrail, falseTrailCard, { kind: 'encounterDeck' })
      .withCard(nextCard, blankTreachery('next_card'), { kind: 'encounterDeck' })
      .start();

    const { state: after, events } = execute(context, state, {
      type: 'DrawEncounter',
      investigatorId: alice,
    });

    const draws = events.filter((event) => event.type === 'EncounterCardDrawn');
    expect(draws.map((event) => event.cardId)).toEqual(drawn);
    expect(after.pending).toMatchObject(pending);
  });

  it('places the card before the surge draw', () => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall, clues: 0 })
      .withCard(falseTrail, falseTrailCard, { kind: 'encounterDeck' })
      .withCard(nextCard, blankTreachery('next_card'), { kind: 'encounterDeck' })
      .withCard(instanceId('untouched'), blankTreachery('untouched'), { kind: 'encounterDeck' })
      .start();

    const after = stateAfter(context, state, { type: 'DrawEncounter', investigatorId: alice });

    expect(after.order[zoneKey({ kind: 'encounterDiscard' })]).toEqual([nextCard, falseTrail]);
  });

  it('keeps no surge for the next draw of the card', () => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall, clues: 0 })
      .withCard(falseTrail, falseTrailCard, { kind: 'encounterDeck' })
      .withCard(nextCard, blankTreachery('next_card'), { kind: 'encounterDeck' })
      .withCard(instanceId('untouched'), blankTreachery('untouched'), { kind: 'encounterDeck' })
      .start();
    const surged = stateAfter(
      context,
      state,
      { type: 'DrawEncounter', investigatorId: alice },
      { type: 'MoveCard', cardId: falseTrail, to: { kind: 'encounterDeck' }, index: 0 },
      { type: 'AdjustInvestigator', investigatorId: alice, stat: 'clues', delta: 1 },
    );

    const { events } = execute(context, surged, { type: 'DrawEncounter', investigatorId: alice });

    const draws = events.filter((event) => event.type === 'EncounterCardDrawn');
    expect(draws.map((event) => event.cardId)).toEqual([falseTrail]);
  });

  it('surges once the test that follows the gained surge is answered', () => {
    const asking = instanceId('asking_trail');
    const askingCard = blankTreachery('asking_trail', {
      abilities: [whenRevealed(gainSurge(), skillTest('intellect', 4))],
    });
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(asking, askingCard, { kind: 'encounterDeck' })
      .withCard(nextCard, blankTreachery('next_card'), { kind: 'encounterDeck' })
      .withCard(instanceId('untouched'), blankTreachery('untouched'), { kind: 'encounterDeck' })
      .start();
    const asked = stateAfter(context, state, { type: 'DrawEncounter', investigatorId: alice });

    const { events } = execute(context, asked, answer('test:asking_trail', 'pass'));

    const draws = events.filter((event) => event.type === 'EncounterCardDrawn');
    expect(draws.map((event) => event.cardId)).toEqual([nextCard]);
  });

  it('surges when the revelation puts the card into a threat area after gaining surge', () => {
    const clinging = instanceId('clinging_trail');
    const clingingCard = blankTreachery('clinging_trail', {
      abilities: [whenRevealed(gainSurge(), putIntoThreatArea())],
    });
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(clinging, clingingCard, { kind: 'encounterDeck' })
      .withCard(nextCard, blankTreachery('next_card'), { kind: 'encounterDeck' })
      .withCard(instanceId('untouched'), blankTreachery('untouched'), { kind: 'encounterDeck' })
      .start();

    const { state: after, events } = execute(context, state, {
      type: 'DrawEncounter',
      investigatorId: alice,
    });

    const draws = events.filter((event) => event.type === 'EncounterCardDrawn');
    expect(draws.map((event) => event.cardId)).toEqual([clinging, nextCard]);
    expect(after.cards[clinging]?.zone).toEqual(threatAreaOf(alice));
  });

  it('draws nothing more for a drawer the card defeated', () => {
    const deadly = instanceId('deadly_trail');
    const deadlyCard = blankTreachery('deadly_trail', {
      abilities: [whenRevealed(gainSurge(), takeDamage(1))],
    });
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall, health: { max: 1, damage: 0 } })
      .withInvestigator(investigatorId('bob'), { locationId: hall })
      .withCard(deadly, deadlyCard, { kind: 'encounterDeck' })
      .withCard(nextCard, blankTreachery('next_card'), { kind: 'encounterDeck' })
      .start();

    const { events } = execute(context, state, { type: 'DrawEncounter', investigatorId: alice });

    const draws = events.filter((event) => event.type === 'EncounterCardDrawn');
    expect(draws.map((event) => event.cardId)).toEqual([deadly]);
  });

  it.each([
    { deck: ['first_gainer'], drawn: ['first_gainer'] },
    { deck: ['first_gainer', 'second_gainer'], drawn: ['first_gainer', 'second_gainer'] },
    {
      deck: ['first_gainer', 'second_gainer', 'third_gainer'],
      drawn: ['first_gainer', 'second_gainer', 'third_gainer'],
    },
  ])('draws $drawn from a deck of only $deck, like printed surge', ({ deck, drawn }) => {
    let game = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall });
    for (const code of deck) {
      const gainer = blankTreachery(code, { abilities: [whenRevealed(gainSurge())] });
      game = game.withCard(instanceId(code), gainer, { kind: 'encounterDeck' });
    }
    const { context, state } = game.start();

    const { events } = execute(context, state, { type: 'DrawEncounter', investigatorId: alice });

    const draws = events.filter((event) => event.type === 'EncounterCardDrawn');
    expect(draws.map((event) => event.cardId)).toEqual(drawn.map((code) => instanceId(code)));
  });

  it('draws only once more for a card with printed surge that also gains it', () => {
    const doubled = instanceId('doubled_trail');
    const doubledCard = blankTreachery('doubled_trail', {
      keywords: [{ name: 'surge' }],
      abilities: [whenRevealed(gainSurge())],
    });
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(doubled, doubledCard, { kind: 'encounterDeck' })
      .withCard(nextCard, blankTreachery('next_card'), { kind: 'encounterDeck' })
      .withCard(instanceId('untouched'), blankTreachery('untouched'), { kind: 'encounterDeck' })
      .start();

    const { events } = execute(context, state, { type: 'DrawEncounter', investigatorId: alice });

    const draws = events.filter((event) => event.type === 'EncounterCardDrawn');
    expect(draws.map((event) => event.cardId)).toEqual([doubled, nextCard]);
  });

  it('fires no "if you have" ability in a window that names no investigator', () => {
    const omen = instanceId('clueless_omen');
    const omenCard = blankTreachery('clueless_omen', {
      abilities: [ifYouHave('clues', { max: 0 }, atEndOfRound(discardSelf()))],
    });
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall, clues: 0 })
      .withCard(omen, omenCard, atLocation(hall))
      .withTurnOf(alice)
      .start();

    // The enemy and upkeep phases end round 1.
    const after = stateAfter(
      context,
      state,
      { type: 'EndTurn', investigatorId: alice },
      { type: 'NextPhase' },
      { type: 'NextPhase' },
    );

    expect(after.cards[omen]?.zone).toEqual(atLocation(hall));
  });

  it('rejects surge for a card that is not resolving', () => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(falseTrail, falseTrailCard, { kind: 'encounterDeck' })
      .start();

    expect(rejectionFrom(context, state, { type: 'GainSurge', cardId: falseTrail })).toEqual({
      code: 'notResolving',
      cardId: falseTrail,
    });
  });
});

describe('enemies that heal or ready themselves', () => {
  const bob = investigatorId('bob');
  const nextPhase: Command = { type: 'NextPhase' };

  it('heals 2 damage from an enemy at the end of the round, as the Relentless Dark Young does', () => {
    const regrowing = instanceId('regrowing_horror');
    /** "At the end of the round: heal 2 damage from it." */
    const regrowingCard = blankEnemy('regrowing_horror', {
      health: fixed(5),
      abilities: [atEndOfRound(healSelf(2))],
    });
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(cellar, blankLocation('cellar'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(regrowing, regrowingCard, atLocation(cellar), { tokens: { damage: 3 } })
      .withTurnOf(alice)
      .start();

    const after = stateAfter(
      context,
      state,
      { type: 'EndTurn', investigatorId: alice },
      nextPhase,
      nextPhase,
    );

    expect(after.cards[regrowing]?.tokens).toEqual({ damage: 1 });
  });

  it('heals 1 damage from an enemy after it attacks, as "Wolf-Man" Drew does', () => {
    const howling = instanceId('howling_brute');
    /** "When it attacks: heal 1 damage from it." */
    const howlingCard = blankEnemy('howling_brute', {
      health: fixed(4),
      damage: 1,
      abilities: [afterAttacking(healSelf(1))],
    });
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(howling, howlingCard, engagedWith(alice), { tokens: { damage: 2 } })
      .withTurnOf(alice)
      .start();

    const after = stateAfter(context, state, {
      type: 'DealEnemyAttack',
      enemyId: howling,
      investigatorId: alice,
      damage: 1,
      horror: 0,
    });

    expect(after.cards[howling]?.tokens).toEqual({ damage: 1 });
  });

  it.each([
    { turnOf: alice, exhaustedBefore: true },
    { turnOf: bob, exhaustedBefore: true },
    { turnOf: alice, exhaustedBefore: false },
  ])(
    'readies an enemy at the end of $turnOf’s turn (exhausted before: $exhaustedBefore), as Umôrdhoth does',
    ({ turnOf, exhaustedBefore }) => {
      const restless = instanceId('restless_titan');
      /** "At the end of each investigator's turn: ready it." */
      const restlessCard = blankEnemy('restless_titan', {
        abilities: [atEndOfEachTurn(readySelf())],
      });
      const { context, state } = newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withLocation(cellar, blankLocation('cellar'), { revealed: true })
        .withInvestigator(alice, { locationId: hall })
        .withInvestigator(bob, { locationId: hall })
        .withCard(restless, restlessCard, atLocation(cellar))
        .withTurnOf(turnOf)
        .start();
      const before = exhaustedBefore
        ? stateAfter(context, state, { type: 'ExhaustEnemy', enemyId: restless })
        : state;

      const after = stateAfter(context, before, { type: 'EndTurn', investigatorId: turnOf });

      expect(before.cards[restless]?.exhausted).toBe(exhaustedBefore);
      expect(after.cards[restless]?.exhausted).toBe(false);
    },
  );
});

describe('effects on each investigator', () => {
  const bob = investigatorId('bob');
  const carol = investigatorId('carol');
  /** "Each investigator is defeated." */
  const defeatAllAgenda = blankAgenda('defeat_all_agenda', fixed(3), {
    abilities: [whenAdvanced(defeatEachInvestigator())],
  });
  /** "Each investigator takes 1 horror." */
  const horrorForAllAgenda = blankAgenda('horror_for_all_agenda', fixed(3), {
    abilities: [
      whenAdvanced({
        type: 'AdjustInvestigator',
        investigatorId: { ref: 'eachInvestigator' },
        stat: 'horror',
        delta: 1,
      }),
    ],
  });
  /** One horror defeats an investigator with this sanity. */
  const frail = { max: 1, horror: 0 };
  const sturdy = { max: 5, horror: 0 };
  /** The hall and the first act; each test adds its agenda first, then alice, the lead. */
  const hallTable = newGame()
    .withAct(act1, firstActCard)
    .withLocation(hall, blankLocation('hall'), { revealed: true });

  it('defeats everyone at once: nobody is asked for a new lead, and the scenario ends', () => {
    const { context, state: started } = hallTable
      .withAgenda(agenda1, defeatAllAgenda)
      .withAgenda(agenda2, secondAgendaCard)
      .withInvestigator(alice, { locationId: hall })
      .withInvestigator(bob, { locationId: hall })
      .withInvestigator(carol, { locationId: hall })
      .start();

    const { state, events } = execute(context, started, { type: 'AdvanceAgenda' });

    expect(state.investigators.map((inv) => inv.status)).toEqual([
      'defeated',
      'defeated',
      'defeated',
    ]);
    expect(state.meta.ended).toBe(true);
    expect(state.meta.resolution).toBeUndefined();
    expect(state.pending).toEqual([]);
    expect(events.map((event) => event.type)).not.toContain('LeadInvestigatorChanged');
  });

  it('asks for a new lead among those left once the effect has hit everyone', () => {
    const { context, state: started } = hallTable
      .withAgenda(agenda1, horrorForAllAgenda)
      .withAgenda(agenda2, secondAgendaCard)
      .withInvestigator(alice, { locationId: hall, sanity: frail })
      .withInvestigator(bob, { locationId: hall, sanity: sturdy })
      .withInvestigator(carol, { locationId: hall, sanity: sturdy })
      .start();

    const { state } = execute(context, started, { type: 'AdvanceAgenda' });

    expect(state.investigators.map((inv) => inv.sanity.horror)).toEqual([1, 1, 1]);
    expect(state.pending.map((decision) => decision.options.map((option) => option.id))).toEqual([
      [bob, carol],
    ]);
  });

  it('tests each investigator in turn, the next one after the answer', () => {
    /** "Each investigator tests willpower (3)." */
    const testForAllAgenda = blankAgenda('test_for_all_agenda', fixed(3), {
      abilities: [
        whenAdvanced({
          type: 'TestSkill',
          investigatorId: { ref: 'eachInvestigator' },
          cardId: { ref: 'self' },
          test: { skill: 'willpower', difficulty: 3 },
          onPass: [],
          onFail: [],
        }),
      ],
    });
    const { context, state: started } = hallTable
      .withAgenda(agenda1, testForAllAgenda)
      .withAgenda(agenda2, secondAgendaCard)
      .withInvestigator(alice, { locationId: hall })
      .withInvestigator(bob, { locationId: hall })
      .start();

    const aliceAsked = stateAfter(context, started, { type: 'AdvanceAgenda' });
    const bobAsked = stateAfter(context, aliceAsked, answer('test:agenda1', 'pass'));
    const done = stateAfter(context, bobAsked, answer('test:agenda1', 'pass'));

    expect(aliceAsked.pending.map((decision) => decision.decider)).toEqual([
      { kind: 'investigator', investigatorId: alice },
    ]);
    expect(bobAsked.pending.map((decision) => decision.decider)).toEqual([
      { kind: 'investigator', investigatorId: bob },
    ]);
    expect(done.agenda.current).toBe(agenda2);
  });

  it('makes the only investigator left the lead, without a question', () => {
    const { context, state: started } = hallTable
      .withAgenda(agenda1, horrorForAllAgenda)
      .withAgenda(agenda2, secondAgendaCard)
      .withInvestigator(alice, { locationId: hall, sanity: frail })
      .withInvestigator(bob, { locationId: hall, sanity: frail })
      .withInvestigator(carol, { locationId: hall, sanity: sturdy })
      .start();

    const { state } = execute(context, started, { type: 'AdvanceAgenda' });

    expect(state.meta.leadInvestigator).toBe(carol);
    expect(state.pending).toEqual([]);
  });
});

describe('trigger bus failures', () => {
  /** The cellar's revelation reveals the hall, which is revealed already. */
  const rerevealingCellar = blankLocation('cellar', {
    abilities: [whenRevealed(revealLocation(onlyCopy(cardCode('hall'))))],
  });
  /** Alice in the revealed hall next to the unrevealed cellar; the first act's reverse side runs `effects`. */
  const failingTable = (...effects: AbilityEffect[]) =>
    newGame()
      .withAgenda(agenda1, firstAgendaCard)
      .withAct(act1, blankAct('failing_act', { abilities: [whenAdvanced(...effects)] }))
      .withAct(act2, secondActCard)
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(cellar, rerevealingCellar)
      .withInvestigator(alice, { locationId: hall });

  it('rejects an act whose reverse side keeps advancing it', () => {
    const { context, state } = failingTable(advanceAct()).start();

    const rejection = rejectionFrom(context, state, { type: 'AdvanceAct' });

    expect(rejection).toEqual({ code: 'triggerLoop', limit: MAX_TRIGGERED_COMMANDS });
  });

  it('rejects the originating command when a forced effect is invalid, naming its reason', () => {
    const { context, state } = failingTable(revealLocation(onlyCopy(cardCode('hall')))).start();

    const rejection = rejectionFrom(context, state, { type: 'AdvanceAct' });

    expect(rejection).toEqual({
      code: 'triggeredCommandRejected',
      command: 'RevealLocation',
      reason: { code: 'alreadyRevealed', cardId: hall },
    });
  });

  it('reports the innermost rejected forced effect of a nested chain', () => {
    const { context, state } = failingTable(revealLocation(onlyCopy(cardCode('cellar')))).start();

    const rejection = rejectionFrom(context, state, { type: 'AdvanceAct' });

    expect(rejection).toEqual({
      code: 'triggeredCommandRejected',
      command: 'RevealLocation',
      reason: { code: 'alreadyRevealed', cardId: hall },
    });
  });
});

describe('trigger bus loop guard', () => {
  /**
   * The first act's reverse side places `actDoom` doom on the agenda, one
   * effect each, then reveals the cellar, whose revelation places
   * `cellarDoom` more: `actDoom + 1 + cellarDoom` forced effects in one chain.
   */
  const chainTable = (actDoom: number, cellarDoom: number) =>
    newGame()
      .withAgenda(agenda1, firstAgendaCard)
      .withAct(
        act1,
        blankAct('dooming_act', {
          abilities: [
            whenAdvanced(
              ...Array.from({ length: actDoom }, () => placeDoomOnAgenda(1)),
              revealLocation(onlyCopy(cardCode('cellar'))),
            ),
          ],
        }),
      )
      .withAct(act2, secondActCard)
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(
        cellar,
        blankLocation('cellar', {
          abilities: [
            whenRevealed(...Array.from({ length: cellarDoom }, () => placeDoomOnAgenda(1))),
          ],
        }),
      )
      .withInvestigator(alice, { locationId: hall });

  it.each([
    { name: 'only the reveal', actDoom: 0, cellarDoom: 0, doom: undefined },
    { name: 'a short chain', actDoom: 5, cellarDoom: 5, doom: 10 },
    {
      name: 'a chain of exactly the limit',
      actDoom: MAX_TRIGGERED_COMMANDS - 6,
      cellarDoom: 5,
      doom: MAX_TRIGGERED_COMMANDS - 1,
    },
  ])('finishes $name within the guard', ({ actDoom, cellarDoom, doom }) => {
    const { context, state: started } = chainTable(actDoom, cellarDoom).start();

    const { state } = execute(context, started, { type: 'AdvanceAct' });

    expect(state.cards[agenda1]?.tokens.doom).toBe(doom);
    expect(checkInvariants(state)).toEqual([]);
  });

  it('rejects a chain one past the limit, counted over every card it reaches, and leaves the state unchanged', () => {
    const { context, state } = chainTable(MAX_TRIGGERED_COMMANDS - 5, 5).start();
    const snapshot = structuredClone(state);

    const rejection = rejectionFrom(context, state, { type: 'AdvanceAct' });

    expect(rejection).toEqual({ code: 'triggerLoop', limit: MAX_TRIGGERED_COMMANDS });
    expect(state).toEqual(snapshot);
  });
});
