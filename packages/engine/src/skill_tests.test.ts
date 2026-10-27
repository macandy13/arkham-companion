import { describe, expect, it } from 'vitest';
import {
  atLocation,
  attachedTo,
  blankEnemy,
  blankLocation,
  afterTest,
  blankTreachery,
  discardSelf,
  decisionId,
  engagedWith,
  fixed,
  handle,
  instanceId,
  investigatorId,
  newGame,
  putIntoThreatArea,
  skillTest,
  skillTestDecision,
  skillTestOfEither,
  takeHorror,
  whenRevealed,
  zoneKey,
  type CardStats,
  type Command,
  type Zone,
} from './index';
import { requireInvestigator } from './investigators';
import { answer, rejectionFrom, stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const study = instanceId('study');
const hallway = instanceId('hallway');
const ghoul = instanceId('ghoul');

/** The study (shroud 3, 2 clues) next to the bare hallway (shroud 1, no clues). */
const studyCard = blankLocation('study', { name: 'Study', shroud: 3, clues: fixed(2) });
const hallwayCard = blankLocation('hallway', { name: 'Hallway', shroud: 1 });

/**
 * A ghoul (fight 4, evade 2, 3 health), a massive ghoul (evade 5), an aloof
 * ghoul (fight 3) and a ghoul that is both massive and aloof (fight 3).
 */
const ghoulCard = blankEnemy('ghoul', { fight: 4, evade: 2, health: fixed(3) });
const massiveGhoul = blankEnemy('massive_ghoul', { evade: 5, keywords: [{ name: 'massive' }] });
const aloofGhoul = blankEnemy('aloof_ghoul', { fight: 3, keywords: [{ name: 'aloof' }] });
const massiveAloofGhoul = blankEnemy('massive_aloof_ghoul', {
  fight: 3,
  keywords: [{ name: 'massive' }, { name: 'aloof' }],
});

/**
 * Treacheries with a revelation test that is discarded (willpower 4) or stays
 * in the threat area (agility 2), and one without a test.
 */
const chillingTreachery = blankTreachery('chilling_treachery', {
  abilities: [whenRevealed(skillTest('willpower', 4))],
});
const clingingTreachery = blankTreachery('clinging_treachery', {
  abilities: [whenRevealed(putIntoThreatArea(), skillTest('agility', 2))],
});
const plainTreachery = blankTreachery('plain_treachery');

/**
 * Location attachments that add 2 shroud and leave after a successful
 * investigation (fog) or add 1 and stay (lasting fog).
 */
const fogCard = blankTreachery('fog', {
  name: 'Fog',
  abilities: [afterTest('investigate', 'pass', discardSelf())],
  modifiers: [{ stat: 'shroud', of: 'host', by: 2 }],
});
const lastingFogCard = blankTreachery('lasting_fog', {
  name: 'Lasting Fog',
  modifiers: [{ stat: 'shroud', of: 'host', by: 1 }],
});

/**
 * Alice (willpower 2, intellect 4) in the revealed study (2 clues) next to the
 * unrevealed hallway; still in setup, so no turn is needed.
 */
const aliceInStudy = newGame()
  .withLocation(study, studyCard, { revealed: true })
  .withLocation(hallway, hallwayCard)
  .withConnection(study, hallway)
  .withInvestigator(alice, {
    locationId: study,
    skills: { willpower: 2, intellect: 4, combat: 3, agility: 3 },
  });

describe('Investigate', () => {
  const investigate: Command = { type: 'Investigate', investigatorId: alice };

  it('asks alice for an intellect test against the shroud, passing for 1 to 2 clues', () => {
    const { context, state } = aliceInStudy.start();

    const asked = stateAfter(context, state, investigate);

    expect(asked.pending).toEqual([
      {
        id: 'investigate:alice',
        kind: 'skillTestResult',
        prompt: 'decision.investigate',
        subject: study,
        decider: { kind: 'investigator', investigatorId: alice },
        skillTest: { skill: 'intellect', difficulty: 3 },
        testKind: { kind: 'investigate', locationId: study },
        // The whole suggestion is covered in skill_modifiers.test.ts.
        suggestion: expect.objectContaining({ skill: 4, difficulty: 3, outcome: 'pass' }),
        options: [
          {
            id: 'pass',
            label: 'decision.pass',
            amount: { default: 1, min: 1, max: 2 },
            commands: [],
          },
          { id: 'fail', label: 'decision.fail', commands: [] },
        ],
      },
    ]);
  });

  it('discovers 1 clue on a pass by default', () => {
    const { context, state } = aliceInStudy.start();

    const passed = stateAfter(context, state, investigate, answer('investigate:alice', 'pass'));

    expect(requireInvestigator(passed, alice).clues).toBe(1);
    expect(passed.cards[study]!.tokens.clue).toBe(1);
  });

  it('discovers nothing on a pass when the clues were taken off while the test was open', () => {
    const { context, state } = aliceInStudy.start();
    const removeBothClues: Command = {
      type: 'ManualAdjust',
      adjustment: { kind: 'tokens', cardId: study, token: 'clue', delta: -2 },
    };

    const passed = stateAfter(
      context,
      state,
      investigate,
      removeBothClues,
      answer('investigate:alice', 'pass'),
    );

    expect(requireInvestigator(passed, alice).clues).toBe(0);
    expect(passed.pending).toEqual([]);
  });

  it('discovers only the clues left when some were taken off while the test was open', () => {
    const { context, state } = aliceInStudy.start();
    const removeOneClue: Command = {
      type: 'ManualAdjust',
      adjustment: { kind: 'tokens', cardId: study, token: 'clue', delta: -1 },
    };

    const passed = stateAfter(
      context,
      state,
      investigate,
      removeOneClue,
      answer('investigate:alice', 'pass', 2),
    );

    expect(requireInvestigator(passed, alice).clues).toBe(1);
  });

  it('discovers the number of clues the players confirm', () => {
    const { context, state } = aliceInStudy.start();

    const passed = stateAfter(context, state, investigate, answer('investigate:alice', 'pass', 2));

    expect(requireInvestigator(passed, alice).clues).toBe(2);
    expect(passed.cards[study]!.tokens.clue ?? 0).toBe(0);
  });

  it.each([
    { name: 'more clues than the location has', amount: 3 },
    { name: 'no clue', amount: 0 },
  ])('rejects confirming $name', ({ amount }) => {
    const { context, state } = aliceInStudy.start();
    const asked = stateAfter(context, state, investigate);

    expect(rejectionFrom(context, asked, answer('investigate:alice', 'pass', amount))).toEqual({
      code: 'amountOutOfRange',
      decisionId: decisionId('investigate:alice'),
      optionId: 'pass',
      amount,
      min: 1,
      max: 2,
    });
  });

  it('rejects a count for the fail option', () => {
    const { context, state } = aliceInStudy.start();
    const asked = stateAfter(context, state, investigate);

    expect(rejectionFrom(context, asked, answer('investigate:alice', 'fail', 1))).toEqual({
      code: 'amountNotAdjustable',
      decisionId: decisionId('investigate:alice'),
      optionId: 'fail',
    });
  });

  it('changes nothing on a fail', () => {
    const { context, state } = aliceInStudy.start();

    const failed = stateAfter(context, state, investigate, answer('investigate:alice', 'fail'));

    expect(requireInvestigator(failed, alice).clues).toBe(0);
    expect(failed.cards[study]!.tokens.clue).toBe(2);
  });

  it('accepts a pass at a location without clues, which discovers nothing', () => {
    const { context, state } = aliceInStudy.start();
    const inHallway = stateAfter(context, state, {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: hallway,
    });

    const passed = stateAfter(context, inHallway, investigate, answer('investigate:alice', 'pass'));

    expect(requireInvestigator(passed, alice).clues).toBe(0);
    expect(passed.pending).toEqual([]);
  });

  it('rejects an investigator who is not at a location', () => {
    const { context, state: nowhere } = newGame()
      .withLocation(study, studyCard)
      .withInvestigator(alice)
      .start();

    expect(rejectionFrom(context, nowhere, investigate)).toEqual({
      code: 'investigatorHasNoLocation',
      investigatorId: alice,
    });
  });
});

describe('Investigate at a location with attachments', () => {
  const investigate: Command = { type: 'Investigate', investigatorId: alice };
  const fog = instanceId('fog_card');
  const lastingFog = instanceId('lasting_fog_card');
  const bothFogsInStudy = aliceInStudy
    .withCard(fog, fogCard, attachedTo(study))
    .withCard(lastingFog, lastingFogCard, attachedTo(study));

  it('tests against the printed shroud 3 plus 2 and 1 from the attachments', () => {
    const { context, state } = bothFogsInStudy.start();

    const asked = stateAfter(context, state, investigate);

    expect(asked.pending[0]?.skillTest).toEqual({ skill: 'intellect', difficulty: 6 });
  });

  it('discards the fog on a pass and keeps the lasting fog', () => {
    const { context, state } = bothFogsInStudy.start();

    const asked = stateAfter(context, state, investigate);

    const passed = stateAfter(context, asked, answer('investigate:alice', 'pass'));
    expect(requireInvestigator(passed, alice).clues).toBe(1);
    expect(passed.order[zoneKey(attachedTo(study))]).toEqual([lastingFog]);
    expect(passed.order[zoneKey({ kind: 'encounterDiscard' })]).toEqual([fog]);
  });

  it('keeps both on a fail', () => {
    const { context, state } = bothFogsInStudy.start();

    const failed = stateAfter(context, state, investigate, answer('investigate:alice', 'fail'));

    expect(failed.order[zoneKey(attachedTo(study))]).toEqual([fog, lastingFog]);
  });
});

describe('Fight', () => {
  const fight: Command = { type: 'Fight', investigatorId: alice, enemyId: ghoul };

  it('asks alice for a combat test against the fight value, passing for the basic 1 damage or more', () => {
    const { context, state } = aliceInStudy.withCard(ghoul, ghoulCard, engagedWith(alice)).start();

    const asked = stateAfter(context, state, fight);

    expect(asked.pending[0]).toMatchObject({
      id: 'fight:alice:ghoul',
      prompt: 'decision.fight',
      subject: ghoul,
      skillTest: { skill: 'combat', difficulty: 4 },
      testKind: { kind: 'fight', enemyId: ghoul, damage: 1 },
      options: [
        { id: 'pass', amount: { default: 1, min: 1 }, commands: [] },
        { id: 'fail', commands: [] },
      ],
    });
  });

  it('deals 1 damage on a pass by default', () => {
    const { context, state } = aliceInStudy.withCard(ghoul, ghoulCard, engagedWith(alice)).start();
    const asked = stateAfter(context, state, fight);

    const passed = stateAfter(context, asked, answer('fight:alice:ghoul', 'pass'));

    expect(passed.cards[ghoul]!.tokens.damage).toBe(1);
  });

  it('deals the damage of the weapon used by default', () => {
    const { context, state } = aliceInStudy.withCard(ghoul, ghoulCard, engagedWith(alice)).start();
    const asked = stateAfter(context, state, { ...fight, damage: 2 });

    const passed = stateAfter(context, asked, answer('fight:alice:ghoul', 'pass'));

    expect(passed.cards[ghoul]!.tokens.damage).toBe(2);
  });

  it('deals the damage the players confirm, which can defeat the enemy', () => {
    const { context, state } = aliceInStudy.withCard(ghoul, ghoulCard, engagedWith(alice)).start();
    const asked = stateAfter(context, state, fight);

    const passed = stateAfter(context, asked, answer('fight:alice:ghoul', 'pass', 3));

    expect(passed.cards[ghoul]!.zone).toEqual({ kind: 'encounterDiscard' });
  });

  it('can attack an unengaged enemy at the location', () => {
    const { context, state } = aliceInStudy.withCard(ghoul, ghoulCard, engagedWith(alice)).start();

    const asked = stateAfter(context, state, { type: 'DisengageEnemy', enemyId: ghoul }, fight);

    expect(asked.pending.map((decision) => decision.id)).toEqual(['fight:alice:ghoul']);
  });

  it('rejects attacking an aloof enemy nobody is engaged with', () => {
    const { context, state } = aliceInStudy.withCard(ghoul, aloofGhoul, atLocation(study)).start();

    expect(rejectionFrom(context, state, fight)).toEqual({
      code: 'aloofNotEngaged',
      cardId: ghoul,
    });
  });

  it('can attack an aloof enemy engaged with another investigator at the location', () => {
    const { context, state } = newGame()
      .withLocation(study, studyCard)
      .withInvestigator(alice, { locationId: study })
      .withInvestigator(bob, { locationId: study })
      .withCard(ghoul, aloofGhoul, engagedWith(bob))
      .start();

    const asked = stateAfter(context, state, fight);

    expect(asked.pending[0]).toMatchObject({
      id: 'fight:alice:ghoul',
      skillTest: { skill: 'combat', difficulty: 3 },
    });
  });

  it('can attack a massive aloof enemy, which counts as engaged with everyone at its location', () => {
    const { context, state } = aliceInStudy
      .withCard(ghoul, massiveAloofGhoul, atLocation(study))
      .start();

    const asked = stateAfter(context, state, fight);

    expect(asked.pending[0]).toMatchObject({
      id: 'fight:alice:ghoul',
      skillTest: { skill: 'combat', difficulty: 3 },
    });
  });

  it('rejects an enemy at another location', () => {
    const { context, state } = aliceInStudy.withCard(ghoul, ghoulCard, atLocation(hallway)).start();

    expect(rejectionFrom(context, state, fight)).toEqual({
      code: 'investigatorNotAtLocation',
      investigatorId: alice,
      locationId: hallway,
    });
  });

  it('rejects an enemy that is not in play', () => {
    const { context, state } = aliceInStudy
      .withCard(ghoul, ghoulCard, { kind: 'encounterDeck' })
      .start();

    expect(rejectionFrom(context, state, fight)).toEqual({
      code: 'enemyNotInPlay',
      cardId: ghoul,
    });
  });

  it('rejects a damage amount that is not positive', () => {
    const { context, state } = aliceInStudy.withCard(ghoul, ghoulCard, engagedWith(alice)).start();

    expect(rejectionFrom(context, state, { ...fight, damage: 0 })).toEqual({
      code: 'invalidTokenDelta',
      delta: 0,
    });
  });
});

describe('failed Fight', () => {
  /** Alice and bob (2 health left) in the study. */
  const aliceAndHurtBobInStudy = newGame()
    .withLocation(study, studyCard)
    .withInvestigator(alice, { locationId: study })
    .withInvestigator(bob, { locationId: study, health: { max: 3, damage: 1 } });
  const fightForTwo: Command = { type: 'Fight', investigatorId: alice, enemyId: ghoul, damage: 2 };

  it('deals the attack`s damage to the other investigator engaged with the enemy, which can defeat them', () => {
    const { context, state } = aliceAndHurtBobInStudy
      .withCard(ghoul, ghoulCard, engagedWith(bob))
      .start();

    const failed = stateAfter(context, state, fightForTwo, answer('fight:alice:ghoul', 'fail'));

    expect(requireInvestigator(failed, bob)).toMatchObject({
      health: { max: 3, damage: 3 },
      status: 'defeated',
    });
  });

  it('deals no damage to bob when the enemy was moved onto alice while the test was open', () => {
    const { context, state } = aliceAndHurtBobInStudy
      .withCard(ghoul, ghoulCard, engagedWith(bob))
      .start();
    const moveOntoAlice: Command = {
      type: 'ManualAdjust',
      adjustment: { kind: 'moveCard', cardId: ghoul, to: engagedWith(alice) },
    };

    const failed = stateAfter(
      context,
      state,
      fightForTwo,
      moveOntoAlice,
      answer('fight:alice:ghoul', 'fail'),
    );

    expect(requireInvestigator(failed, bob).health.damage).toBe(1);
  });

  it.each<{ name: string; card: CardStats; zone: Zone; before: Command[] }>([
    { name: 'engaged with the fighter', card: ghoulCard, zone: engagedWith(alice), before: [] },
    {
      name: 'unengaged',
      card: ghoulCard,
      zone: engagedWith(alice),
      before: [{ type: 'DisengageEnemy', enemyId: ghoul }],
    },
    { name: 'massive', card: massiveGhoul, zone: atLocation(study), before: [] },
  ])('deals no damage for an enemy that is $name', ({ card, zone, before }) => {
    const { context, state } = aliceAndHurtBobInStudy.withCard(ghoul, card, zone).start();

    const failed = stateAfter(
      context,
      state,
      ...before,
      fightForTwo,
      answer('fight:alice:ghoul', 'fail'),
    );

    expect(failed.investigators.map((inv) => [inv.id, inv.health.damage])).toEqual([
      ['alice', 0],
      ['bob', 1],
    ]);
  });
});

describe('Evade', () => {
  const evade: Command = { type: 'Evade', investigatorId: alice, enemyId: ghoul };

  it('asks alice for an agility test against the evade value', () => {
    const { context, state } = aliceInStudy.withCard(ghoul, ghoulCard, engagedWith(alice)).start();

    const asked = stateAfter(context, state, evade);

    expect(asked.pending[0]).toMatchObject({
      id: 'evade:alice:ghoul',
      prompt: 'decision.evade',
      skillTest: { skill: 'agility', difficulty: 2 },
    });
  });

  it('exhausts and disengages the enemy on a pass', () => {
    const { context, state } = aliceInStudy.withCard(ghoul, ghoulCard, engagedWith(alice)).start();
    const asked = stateAfter(context, state, evade);

    const passed = stateAfter(context, asked, answer('evade:alice:ghoul', 'pass'));

    expect(passed.cards[ghoul]).toMatchObject({ exhausted: true, zone: atLocation(study) });
  });

  it('only disengages an enemy that is already exhausted', () => {
    const { context, state } = aliceInStudy.withCard(ghoul, ghoulCard, engagedWith(alice)).start();

    const asked = stateAfter(context, state, { type: 'ExhaustEnemy', enemyId: ghoul }, evade);

    const events = handle(context, asked, answer('evade:alice:ghoul', 'pass'));

    expect(events.map((event) => event.type)).toEqual([
      'DecisionResolved',
      'SkillTestResolved',
      'EnemyDisengaged',
    ]);
  });

  it('only exhausts an enemy moved off alice while the test was open', () => {
    const { context, state } = aliceInStudy.withCard(ghoul, ghoulCard, engagedWith(alice)).start();
    const moveToHallway: Command = {
      type: 'ManualAdjust',
      adjustment: { kind: 'moveCard', cardId: ghoul, to: atLocation(hallway) },
    };

    const passed = stateAfter(
      context,
      state,
      evade,
      moveToHallway,
      answer('evade:alice:ghoul', 'pass'),
    );

    expect(passed.cards[ghoul]).toMatchObject({ exhausted: true, zone: atLocation(hallway) });
  });

  it('only exhausts a massive enemy, which stays engaged with everyone at its location', () => {
    const { context, state } = aliceInStudy
      .withCard(ghoul, massiveGhoul, atLocation(study))
      .start();
    const asked = stateAfter(context, state, evade);

    const passed = stateAfter(context, asked, answer('evade:alice:ghoul', 'pass'));

    expect(passed.cards[ghoul]).toMatchObject({ exhausted: true, zone: atLocation(study) });
  });

  it('leaves the enemy engaged on a fail', () => {
    const { context, state } = aliceInStudy.withCard(ghoul, ghoulCard, engagedWith(alice)).start();
    const asked = stateAfter(context, state, evade);

    const failed = stateAfter(context, asked, answer('evade:alice:ghoul', 'fail'));

    expect(failed.cards[ghoul]).toMatchObject({ exhausted: false, zone: engagedWith(alice) });
  });

  it('rejects an enemy that is not engaged with the investigator', () => {
    const { context, state } = aliceInStudy.withCard(ghoul, ghoulCard, atLocation(hallway)).start();

    expect(rejectionFrom(context, state, evade)).toEqual({ code: 'notEngaged', cardId: ghoul });
  });

  it('rejects an aloof enemy at the location that nobody is engaged with', () => {
    const { context, state } = aliceInStudy.withCard(ghoul, aloofGhoul, atLocation(study)).start();

    expect(rejectionFrom(context, state, evade)).toEqual({ code: 'notEngaged', cardId: ghoul });
  });
});

describe('Fight and Evade against values a location changes', () => {
  /** A revealed location whose enemies get +1 fight and +2 evade, where alice is engaged with the ghoul (fight 4, evade 2). */
  const ghoulOnAliceInDarkHall = newGame()
    .withLocation(
      hallway,
      blankLocation('dark_hall', {
        modifiers: [
          { stat: 'fight', of: 'enemiesHere', by: 1 },
          { stat: 'evade', of: 'enemiesHere', by: 2 },
        ],
      }),
      { revealed: true },
    )
    .withInvestigator(alice, { locationId: hallway })
    .withCard(ghoul, ghoulCard, engagedWith(alice));

  it.each<{ action: Command; skillTest: object }>([
    {
      action: { type: 'Fight', investigatorId: alice, enemyId: ghoul },
      skillTest: { skill: 'combat', difficulty: 5 },
    },
    {
      action: { type: 'Evade', investigatorId: alice, enemyId: ghoul },
      skillTest: { skill: 'agility', difficulty: 4 },
    },
  ])('raises $action.type against the changed value', ({ action, skillTest }) => {
    const { context, state } = ghoulOnAliceInDarkHall.start();

    const asked = stateAfter(context, state, action);

    expect(asked.pending[0]?.skillTest).toEqual(skillTest);
  });
});

describe('revelation test', () => {
  const chill = instanceId('chill');
  const draw: Command = { type: 'DrawEncounter', investigatorId: alice };
  /** The chilling treachery (willpower 4) on top of the encounter deck, a plain one below it. */
  const chillOnTop = aliceInStudy
    .withCard(chill, chillingTreachery, { kind: 'encounterDeck' })
    .withCard(instanceId('next_card'), plainTreachery, { kind: 'encounterDeck' });

  it('asks the drawer for the test of a treachery that has one', () => {
    const { context, state } = chillOnTop.start();

    const drawn = stateAfter(context, state, draw);

    expect(drawn.pending).toEqual([
      {
        id: 'test:chill',
        kind: 'skillTestResult',
        prompt: 'decision.cardTest',
        subject: chill,
        decider: { kind: 'investigator', investigatorId: alice },
        skillTest: { skill: 'willpower', difficulty: 4 },
        suggestion: expect.objectContaining({ skill: 2, difficulty: 4, outcome: 'fail' }),
        options: [
          { id: 'pass', label: 'decision.pass', commands: [] },
          { id: 'fail', label: 'decision.fail', commands: [] },
        ],
      },
    ]);
  });

  it('keeps the card out of the discard while its revelation is resolved', () => {
    const { context, state } = chillOnTop.start();

    const drawn = stateAfter(context, state, draw);

    expect(drawn.cards[chill]!.zone).toEqual({ kind: 'resolving' });
  });

  it.each(['pass', 'fail'])('discards the card on top of the discard on a %s', (optionId) => {
    const { context, state } = chillOnTop.start();

    const resolved = stateAfter(context, state, draw, answer('test:chill', optionId));

    expect(resolved.order[zoneKey({ kind: 'encounterDiscard' })]).toEqual([chill]);
  });

  it('leaves what failing costs to the players', () => {
    const { context, state } = chillOnTop.start();

    const failed = stateAfter(context, state, draw, answer('test:chill', 'fail'));

    expect(failed.pending).toEqual([]);
    expect(requireInvestigator(failed, alice)).toMatchObject({
      health: { damage: 0 },
      sanity: { horror: 0 },
    });
  });

  it('puts a treachery into the threat area before its test, as its revelation lists them', () => {
    const clinging = instanceId('clinging');
    const { context, state } = aliceInStudy
      .withCard(clinging, clingingTreachery, { kind: 'encounterDeck' })
      .start();

    const drawn = stateAfter(context, state, draw);
    const answered = stateAfter(context, drawn, answer('test:clinging', 'fail'));

    expect(drawn.cards[clinging]!.zone).toEqual({ kind: 'threatArea', investigatorId: alice });
    expect(answered.cards[clinging]!.zone).toEqual({ kind: 'threatArea', investigatorId: alice });
  });

  it('asks nothing for a treachery without a test', () => {
    const { context, state } = aliceInStudy
      .withCard(instanceId('plain'), plainTreachery, { kind: 'encounterDeck' })
      .start();

    const drawn = stateAfter(context, state, draw);

    expect(drawn.pending).toEqual([]);
  });
});

describe('test of either of two skills', () => {
  const sway = instanceId('sway');
  const swayChoice = decisionId('sway.skill');
  /** A treachery whose revelation tests willpower (3) or agility (3), giving 1 horror on a fail. */
  const swayingTreachery = blankTreachery('swaying_treachery', {
    abilities: [
      whenRevealed(
        skillTestOfEither(swayChoice, ['willpower', 'agility'], 3, {
          onFail: [takeHorror(1)],
        }),
      ),
    ],
  });
  const draw: Command = { type: 'DrawEncounter', investigatorId: alice };

  it('lets the drawer pick the skill', () => {
    const { context, state } = aliceInStudy
      .withCard(sway, swayingTreachery, { kind: 'encounterDeck' })
      .start();

    const drawn = stateAfter(context, state, draw);

    expect(drawn.pending).toMatchObject([
      {
        id: swayChoice,
        kind: 'chooseOption',
        prompt: 'decision.chooseSkill',
        decider: { kind: 'investigator', investigatorId: alice },
        options: [
          { id: 'willpower', label: 'skill.willpower' },
          { id: 'agility', label: 'skill.agility' },
        ],
      },
    ]);
  });

  it.each([
    { skill: 'willpower', result: 'pass', horror: 0 },
    { skill: 'agility', result: 'fail', horror: 1 },
  ])(
    'tests $skill (3) once picked; a $result costs $horror horror',
    ({ skill, result, horror }) => {
      const { context, state } = aliceInStudy
        .withCard(sway, swayingTreachery, { kind: 'encounterDeck' })
        .start();
      const picked = stateAfter(context, state, draw, answer(swayChoice, skill));

      const resolved = stateAfter(context, picked, answer('test:sway', result));

      expect(picked.pending).toMatchObject([{ skillTest: { skill, difficulty: 3 } }]);
      expect(requireInvestigator(resolved, alice).sanity.horror).toBe(horror);
    },
  );
});

describe('card-driven skill test', () => {
  it('applies the fail effect of a card the players resolved at the table', () => {
    const { context, state } = aliceInStudy.start();
    const request: Command = {
      type: 'RequestDecision',
      decision: skillTestDecision(
        {
          id: decisionId('mishap'),
          prompt: 'card.mishap',
          decider: { kind: 'investigator', investigatorId: alice },
          test: { skill: 'willpower', difficulty: 3 },
        },
        {
          onPass: [],
          onFail: [{ type: 'AdjustInvestigator', investigatorId: alice, stat: 'horror', delta: 2 }],
        },
      ),
    };

    const failed = stateAfter(context, state, request, answer('mishap', 'fail'));

    expect(requireInvestigator(failed, alice).sanity.horror).toBe(2);
  });
});
