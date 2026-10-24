import { describe, expect, it } from 'vitest';
import {
  cardImagePath,
  atLocation,
  attachedTo,
  blankAct,
  blankAgenda,
  blankAsset,
  blankEnemy,
  blankLocation,
  blankTreachery,
  boardView,
  byAny,
  byCode,
  byId,
  byName,
  cardCode,
  decisionId,
  engagedWith,
  enemyMatching,
  fixed,
  instanceId,
  investigatorCode,
  investigatorId,
  mapId,
  newGame,
  perInvestigator,
  TableError,
  threatAreaOf,
} from './index';
import { stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const study = instanceId('study');
const hallway = instanceId('hallway');

describe('the phase and turn', () => {
  it('reads the round and phase, with no turn before the first one starts', () => {
    const { context, state } = newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(alice, { locationId: study })
      .withInvestigator(bob, { locationId: study })
      .start();

    const investigation = boardView(context, stateAfter(context, state, { type: 'NextPhase' }));

    expect(investigation).toMatchObject({ round: 1, phase: 'investigation', lead: alice });
    expect(investigation.turn).toBeUndefined();
    expect(boardView(context, state)).toMatchObject({ round: 0, phase: 'setup' });
  });

  it('names whose turn it is', () => {
    const { context, state } = newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(alice, { locationId: study })
      .withInvestigator(bob, { locationId: study })
      .start();

    const board = boardView(
      context,
      stateAfter(context, state, { type: 'NextPhase' }, { type: 'StartTurn', investigatorId: bob }),
    );

    expect(board.turn).toBe(bob);
  });

  it('reads the resolution once the scenario has ended', () => {
    const { context, state } = newGame().withLocation(study, blankLocation('study')).start();

    const board = boardView(
      context,
      stateAfter(context, state, { type: 'EndScenario', resolution: 'r1' }),
    );

    expect(boardView(context, state).ended).toBe(false);
    expect(board).toMatchObject({ ended: true, resolution: 'r1' });
  });
});

describe('investigators', () => {
  it('reads each investigator with their counters, location and threat area', () => {
    const { context, state } = newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(alice, {
        locationId: study,
        clues: 2,
        resources: 5,
        health: { max: 7, damage: 3 },
        sanity: { max: 6, horror: 1 },
        doomOnPlayerCards: 2,
      })
      .withInvestigator(bob)
      .withCard(instanceId('frozen_in_fear'), blankTreachery('frozen_in_fear'), threatAreaOf(alice))
      .start();

    const { investigators } = boardView(context, state);

    expect(investigators).toEqual([
      {
        id: alice,
        name: 'alice',
        status: 'active',
        at: 'study',
        clues: 2,
        resources: 5,
        health: 7,
        damage: 3,
        sanity: 6,
        horror: 1,
        doom: 2,
        actions: 3,
        threatArea: ['frozen_in_fear'],
      },
      expect.objectContaining({ id: bob, clues: 0 }),
    ]);
    expect(investigators[1]).not.toHaveProperty('at');
    expect(investigators[1]).not.toHaveProperty('threatArea');
    expect(investigators[1]).not.toHaveProperty('doom');
  });

  it('marks the investigators who have taken their turn this round', () => {
    const { context, state } = newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(alice, { locationId: study })
      .withInvestigator(bob, { locationId: study })
      .start();
    const afterAlice = stateAfter(
      context,
      state,
      { type: 'NextPhase' },
      { type: 'StartTurn', investigatorId: alice },
      { type: 'EndTurn', investigatorId: alice },
    );

    const board = boardView(context, afterAlice);

    expect(board.investigator(alice).turnTaken).toBe(true);
    expect(board.investigator(bob)).not.toHaveProperty('turnTaken');
  });

  it('shows the actions an investigator has left', () => {
    const { context, state } = newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(alice, { locationId: study })
      .start();

    const board = boardView(
      context,
      stateAfter(context, state, { type: 'AdjustActions', investigatorId: alice, delta: -2 }),
    );

    expect(board.investigator(alice).actions).toBe(1);
  });

  it('finds an investigator by id and fails with the board for an unknown one', () => {
    const { context, state } = newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(alice, { locationId: study })
      .start();
    const board = boardView(context, state);

    expect(board.investigator(alice).id).toBe(alice);
    expect(() => board.investigator(bob)).toThrow(TableError);
    expect(() => board.investigator(bob)).toThrow(/^no investigator with id bob\n/);
  });

  describe('with two investigators', () => {
    const duo = newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(alice, { locationId: study })
      .withInvestigator(bob, { locationId: study });

    it.each([
      { matcher: byId(bob), expected: bob },
      { matcher: bob, expected: bob },
      { matcher: byName('Alice'), expected: alice },
      { matcher: byCode(investigatorCode('bob')), expected: bob },
      { matcher: byAny('bob'), expected: bob },
      { matcher: byAny('ALICE'), expected: alice },
    ])('finds the investigator $expected with $matcher', ({ matcher, expected }) => {
      const { context, state } = duo.start();

      expect(boardView(context, state).investigator(matcher).id).toBe(expected);
    });

    it('fails with the board for a matcher that matches nobody', () => {
      const { context, state } = duo.start();

      expect(() => boardView(context, state).investigator(byAny('zed'))).toThrow(
        /^no investigator with id, code or name "zed"\n/,
      );
    });

    it('fails and lists the ids when several investigators match', () => {
      const { context, state } = newGame()
        .withInvestigator(investigatorId('roland'), { name: 'Roland Banks' })
        .withInvestigator(investigatorId('rita'), { name: 'Rita Young' })
        .withInvestigator(investigatorId('daisy'), { name: 'rita' })
        .start();

      expect(() => boardView(context, state).investigator(byAny('rita'))).toThrow(
        /^2 investigators match with id, code or name "rita"; use one of rita, daisy\n/,
      );
    });
  });

  it.each([
    { field: 'clues' as const, expected: { alice: 2, bob: 0, carol: 1 } },
    { field: 'at' as const, expected: { alice: 'study', bob: 'hallway', carol: undefined } },
    { field: 'actions' as const, expected: { alice: 3, bob: 3, carol: 3 } },
  ])('reads $field of every investigator by id, in seat order', ({ field, expected }) => {
    const { context, state } = newGame()
      .withLocation(study, blankLocation('study'))
      .withLocation(hallway, blankLocation('hallway'))
      .withInvestigator(alice, { locationId: study, clues: 2 })
      .withInvestigator(bob, { locationId: hallway })
      .withInvestigator(investigatorId('carol'), { clues: 1 })
      .start();
    const board = boardView(context, state);

    expect(board.perInvestigator(field)).toEqual(expected);
    expect(Object.keys(board.perInvestigator(field))).toEqual(['alice', 'bob', 'carol']);
  });
});

describe('locations', () => {
  const house = newGame()
    .withLocation(study, blankLocation('study', { clues: fixed(2), shroud: 3 }), { revealed: true })
    .withLocation(hallway, blankLocation('hallway'))
    .withLocation(instanceId('attic'), blankLocation('attic'), { map: mapId('upstairs') })
    .withInvestigator(alice, { locationId: study })
    .withInvestigator(bob, { locationId: study });

  it('reads the locations in map order with what lies on them', () => {
    const { context, state } = house
      .withCard(instanceId('ghoul'), blankEnemy('ghoul'), atLocation(study))
      .withCard(instanceId('old_key'), blankAsset('old_key'), atLocation(study))
      .withCard(instanceId('dark_cloud'), blankTreachery('dark_cloud'), attachedTo(study))
      .start();

    const { locations } = boardView(context, state);

    expect(locations).toEqual([
      {
        id: study,
        name: 'study',
        map: mapId('main'),
        revealed: true,
        shroud: 3,
        clues: 2,
        investigators: [alice, bob],
        cards: ['ghoul', 'old_key'],
        attachments: ['dark_cloud'],
      },
      { id: hallway, name: 'hallway', map: mapId('main'), revealed: false, clues: 0 },
      {
        id: instanceId('attic'),
        name: 'attic',
        map: mapId('upstairs'),
        revealed: false,
        clues: 0,
      },
    ]);
  });

  it('reads the doom on a location and a shroud that its attachments raise', () => {
    const { context, state } = house
      .withLocation(instanceId('cellar'), blankLocation('cellar', { shroud: 2 }), {
        revealed: true,
        doom: 1,
      })
      .withCard(
        instanceId('obscuring_fog'),
        blankTreachery('obscuring_fog', { modifiers: [{ stat: 'shroud', of: 'host', by: 2 }] }),
        attachedTo(instanceId('cellar')),
      )
      .start();

    expect(boardView(context, state).location(byName('cellar'))).toMatchObject({
      shroud: 4,
      doom: 1,
    });
  });

  it.each([
    { revealed: true, image: '/cards/cellar_revealed.png' },
    { revealed: false, image: '/cards/cellar_unrevealed.png' },
  ])(
    'shows the picture of the side a location shows, revealed: $revealed',
    ({ revealed, image }) => {
      const { context, state } = house
        .withLocation(
          instanceId('cellar'),
          blankLocation('cellar', {
            imageSrc: cardImagePath('/cards/cellar_revealed.png'),
            backImageSrc: cardImagePath('/cards/cellar_unrevealed.png'),
          }),
          { revealed },
        )
        .start();

      expect(boardView(context, state).location(byName('cellar')).image).toBe(image);
    },
  );

  it('leaves out locations that are not on a map', () => {
    const { context, state } = house
      .withCard(instanceId('cellar'), blankLocation('cellar'), { kind: 'setAside' })
      .start();

    const names = boardView(context, state).locations.map((location) => location.name);

    expect(names).toEqual(['study', 'hallway', 'attic']);
  });

  it('reads each map with the layout cells and connections of its locations', () => {
    const attic = instanceId('attic');
    const { context, state } = newGame()
      .withLocation(study, blankLocation('study'), { at: { column: 0, row: 0 } })
      .withLocation(hallway, blankLocation('hallway'))
      .withLocation(attic, blankLocation('attic'), {
        map: mapId('upstairs'),
        at: { column: 2, row: 1 },
      })
      .withConnection(study, hallway)
      .withConnection(hallway, attic, { oneWay: true })
      .start();

    const maps = boardView(context, state).maps.map(({ id, locations, cells, connections }) => ({
      id,
      locations: locations.map((location) => location.name),
      cells,
      connections,
    }));

    expect(maps).toEqual([
      {
        id: mapId('main'),
        locations: ['study', 'hallway'],
        cells: { [study]: { column: 0, row: 0 } },
        connections: [{ from: study, to: hallway, oneWay: false }],
      },
      {
        id: mapId('upstairs'),
        locations: ['attic'],
        cells: { [attic]: { column: 2, row: 1 } },
        connections: [],
      },
    ]);
  });

  it('lists the enemies at each location of a map, the engaged ones at their investigator', () => {
    const { context, state } = house
      .withCard(instanceId('ghoul'), blankEnemy('ghoul', { health: fixed(3) }), atLocation(hallway))
      .withCard(instanceId('rat'), blankEnemy('rat', { health: fixed(1) }), engagedWith(alice))
      .start();

    const [main] = boardView(context, state).maps;

    expect(main?.enemies).toEqual({
      [study]: [{ id: instanceId('rat'), name: 'rat', at: 'study', engagedWith: alice, health: 1 }],
      [hallway]: [{ id: instanceId('ghoul'), name: 'ghoul', at: 'hallway', health: 3 }],
    });
  });

  it.each([
    { map: 'main', expected: ['study', 'hallway'] },
    { map: 'upstairs', expected: ['attic'] },
    { map: 'cellar', expected: [] },
  ])('lists the locations on the $map map in map order', ({ map, expected }) => {
    const { context, state } = house
      .withCard(instanceId('pantry'), blankLocation('pantry'), { kind: 'setAside' })
      .start();

    expect(boardView(context, state).locationsOn(mapId(map))).toEqual(expected);
  });

  it('turns revealed true once RevealLocation flips the location', () => {
    const { context, state } = house.start();

    const board = boardView(
      context,
      stateAfter(context, state, { type: 'RevealLocation', locationId: hallway }),
    );

    expect(board.location(byName('hallway')).revealed).toBe(true);
    expect(boardView(context, state).location(byName('hallway')).revealed).toBe(false);
  });

  it.each([
    { matcher: byName('study'), found: study },
    { matcher: byName('Study'), found: study },
    { matcher: byId(hallway), found: hallway },
    { matcher: hallway, found: hallway },
    { matcher: byCode(cardCode('hallway')), found: hallway },
    { matcher: byAny('attic'), found: instanceId('attic') },
    { matcher: byAny('HALLWAY'), found: hallway },
  ])('finds the location $found with $matcher', ({ matcher, found }) => {
    const { context, state } = house.start();

    expect(boardView(context, state).location(matcher).id).toBe(found);
  });

  it('fails with the board for a location that is not in play', () => {
    const { context, state } = house
      .withCard(instanceId('cellar'), blankLocation('cellar'), { kind: 'setAside' })
      .start();
    const board = boardView(context, state);

    expect(() => board.location(byName('cellar'))).toThrow(/^no location named "cellar" in play\n/);
    expect(() => board.location(byName('garden'))).toThrow(TableError);
  });

  it('fails and lists the ids when several locations share a name', () => {
    const cellar = blankLocation('cellar');
    const { context, state } = newGame()
      .withLocation(instanceId('cellar_east'), cellar)
      .withLocation(instanceId('cellar_west'), cellar)
      .start();
    const board = boardView(context, state);

    expect(() => board.location(byName('cellar'))).toThrow(TableError);
    expect(() => board.location(byName('cellar'))).toThrow(
      /^2 locations match named "cellar"; use one of cellar_east, cellar_west\n/,
    );
    expect(board.location(byId(instanceId('cellar_west'))).id).toBe('cellar_west');
  });
});

describe('enemies', () => {
  it('reads each enemy in play with where it is and what is on it', () => {
    const ghoul = blankEnemy('ghoul', { health: fixed(4) });
    const { context, state } = newGame()
      .withLocation(study, blankLocation('study'))
      .withLocation(hallway, blankLocation('hallway'))
      .withInvestigator(alice, { locationId: study })
      .withCard(
        instanceId('lurker'),
        blankEnemy('lurker', { health: fixed(3) }),
        atLocation(hallway),
      )
      .withCard(instanceId('ghoul'), ghoul, engagedWith(alice), { tokens: { damage: 2 } })
      .withCard(instanceId('set_aside_ghoul'), ghoul, { kind: 'setAside' })
      .start();

    const { enemies } = boardView(context, state);

    expect(enemies).toEqual([
      { name: 'lurker', at: 'hallway', health: 3 },
      { name: 'ghoul', at: 'study', engagedWith: alice, health: 4, damage: 2 },
    ]);
  });

  it("reads an enemy's health for the number of investigators", () => {
    const { context, state } = newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(alice, { locationId: study })
      .withInvestigator(bob, { locationId: study })
      .withCard(
        instanceId('ghoul_priest'),
        blankEnemy('ghoul_priest', { health: perInvestigator(5) }),
        atLocation(study),
      )
      .start();

    const [ghoulPriest] = boardView(context, state).enemies;

    expect(ghoulPriest?.health).toBe(10);
  });

  it('lists the enemies engaged with an investigator', () => {
    const { context, state } = newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(alice, { locationId: study })
      .withInvestigator(bob, { locationId: study })
      .withCard(instanceId('lurker'), blankEnemy('lurker'), atLocation(study))
      .withCard(instanceId('ghoul'), blankEnemy('ghoul'), engagedWith(alice))
      .withCard(instanceId('rat'), blankEnemy('rat'), engagedWith(bob))
      .start();

    const board = boardView(context, state);

    expect(board.enemiesEngagedWith(alice).map(({ name }) => name)).toEqual(['ghoul']);
  });

  it('marks an exhausted enemy', () => {
    const { context, state } = newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(alice, { locationId: study })
      .withCard(instanceId('ghoul'), blankEnemy('ghoul'), engagedWith(alice))
      .start();
    const attacked = stateAfter(
      context,
      state,
      { type: 'NextPhase' },
      { type: 'StartTurn', investigatorId: alice },
      { type: 'EndTurn', investigatorId: alice },
      { type: 'NextPhase' },
      { type: 'ResolveEnemyAttack', enemyId: instanceId('ghoul'), investigatorId: alice },
    );

    const [ghoul] = boardView(context, attacked).enemies;

    expect(ghoul).toMatchObject({ name: 'ghoul', exhausted: true });
  });

  describe('with three rats around', () => {
    const rat = blankEnemy('rat', { health: fixed(1) });
    const ghoul = blankEnemy('ghoul', { health: fixed(3) });
    const rats = newGame()
      .withLocation(study, blankLocation('study'))
      .withLocation(hallway, blankLocation('hallway'))
      .withInvestigator(alice, { locationId: study })
      .withInvestigator(bob, { locationId: study })
      .withCard(instanceId('rat_on_alice'), rat, engagedWith(alice))
      .withCard(instanceId('rat_on_bob'), rat, engagedWith(bob))
      .withCard(instanceId('rat_in_hallway'), rat, atLocation(hallway))
      .withCard(instanceId('ghoul'), ghoul, atLocation(study));

    const inHallway = { name: 'rat', at: 'hallway', health: 1 };
    const onAlice = { name: 'rat', at: 'study', engagedWith: alice, health: 1 };
    const ghoulInStudy = { name: 'ghoul', at: 'study', health: 3 };
    const any_rat = byName('rat');

    it.each([
      { selector: byName('ghoul'), found: ghoulInStudy },
      { selector: byName('Ghoul'), found: ghoulInStudy },
      { selector: byAny('rat_in_hallway'), found: inHallway },
      { selector: byAny('GHOUL'), found: ghoulInStudy },
      { selector: byId(instanceId('rat_in_hallway')), found: inHallway },
      { selector: enemyMatching(any_rat, { engagedWith: alice }), found: onAlice },
      {
        selector: enemyMatching(any_rat, { engagedWith: bob }),
        found: { ...onAlice, engagedWith: bob },
      },
      { selector: enemyMatching(any_rat, { at: byName('hallway') }), found: inHallway },
      { selector: enemyMatching(any_rat, { at: byId(hallway) }), found: inHallway },
      { selector: instanceId('rat_in_hallway'), found: inHallway },
      { selector: enemyMatching(instanceId('rat_in_hallway')), found: inHallway },
      { selector: enemyMatching(any_rat, { at: hallway }), found: inHallway },
      { selector: enemyMatching(any_rat, { engagedWith: byName('Alice') }), found: onAlice },
      {
        selector: enemyMatching(any_rat, { engagedWith: alice, at: byName('study') }),
        found: onAlice,
      },
    ])('finds $found with $selector', ({ selector, found }) => {
      const { context, state } = rats.start();

      expect(boardView(context, state).enemy(selector)).toEqual(found);
    });

    it('fails and says how to narrow when several enemies match', () => {
      const { context, state } = rats.start();
      const board = boardView(context, state);

      expect(() => board.enemy(any_rat)).toThrow(
        /^3 enemies match named "rat" \(rat_on_alice, rat_on_bob, rat_in_hallway\); narrow it with enemyMatching\(card, \{ engagedWith, at \}\), or use byId[^\n]*\n/,
      );
      expect(() => board.enemy(enemyMatching(any_rat, { at: byName('study') }))).toThrow(
        /^2 enemies match/,
      );
    });

    it.each([
      { selector: byName('goblin'), message: 'no enemy in play named "goblin"' },
      {
        selector: enemyMatching(byName('ghoul'), { engagedWith: alice }),
        message: 'no enemy in play named "ghoul" engaged with an investigator with id alice',
      },
      {
        selector: enemyMatching(byName('ghoul'), { at: byName('hallway') }),
        message: 'no enemy in play named "ghoul" at a location named "hallway"',
      },
    ])('fails with the board when $selector matches nothing', ({ selector, message }) => {
      const { context, state } = rats.start();

      expect(() => boardView(context, state).enemy(selector)).toThrow(TableError);
      expect(() => boardView(context, state).enemy(selector)).toThrow(message);
    });

    it('fails when the location of the selector is not in play', () => {
      const { context, state } = rats.start();

      expect(() =>
        boardView(context, state).enemy(enemyMatching(any_rat, { at: byName('cellar') })),
      ).toThrow(/no location named "cellar" in play/);
    });

    it('does not find an enemy outside play', () => {
      const { context, state } = rats
        .withCard(instanceId('stored_goblin'), blankEnemy('goblin'), { kind: 'setAside' })
        .start();

      expect(() => boardView(context, state).enemy(byName('goblin'))).toThrow(TableError);
    });
  });
});

describe('agenda and act', () => {
  it('reads the current agenda with its doom and threshold, the doom in play, the act with its clue requirement and the clues held', () => {
    const { context, state } = newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(alice, { locationId: study, clues: 1 })
      .withInvestigator(bob, { locationId: study, clues: 2 })
      .withAgenda(instanceId('first_agenda'), blankAgenda('first_agenda', fixed(3)))
      .withAct(instanceId('first_act'), blankAct('first_act', { clues: perInvestigator(2) }))
      .withCard(instanceId('doomed_curse'), blankTreachery('doomed_curse'), threatAreaOf(alice), {
        tokens: { doom: 1 },
      })
      .start();

    const board = boardView(context, stateAfter(context, state, { type: 'PlaceDoom', amount: 2 }));

    expect(board.agenda).toEqual({ name: 'first_agenda', doom: 2, threshold: 3 });
    expect(board.doomInPlay).toBe(3);
    expect(board.act).toEqual({ name: 'first_act', clues: 0, threshold: 4 });
    expect(board.cluesHeld).toBe(3);
  });

  it('counts the clues the players put on the act', () => {
    const { context, state } = newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(alice, { locationId: study })
      .withAct(instanceId('first_act'), blankAct('first_act', { clues: fixed(3) }))
      .start();

    const board = boardView(
      context,
      stateAfter(context, state, {
        type: 'ManualAdjust',
        adjustment: { kind: 'tokens', cardId: instanceId('first_act'), token: 'clue', delta: 2 },
      }),
    );

    expect(board.act).toEqual({ name: 'first_act', clues: 2, threshold: 3 });
  });

  it('reads an agenda without a doom threshold without one', () => {
    const { context, state } = newGame()
      .withLocation(study, blankLocation('study'))
      .withAgenda(instanceId('final_agenda'), blankAgenda('final_agenda', null))
      .start();

    const board = boardView(context, state);

    expect(board.agenda).toEqual({ name: 'final_agenda', doom: 0 });
  });

  it('shows the pictures of the agenda and act fronts', () => {
    const { context, state } = newGame()
      .withLocation(study, blankLocation('study'))
      .withAgenda(
        instanceId('first_agenda'),
        blankAgenda('first_agenda', fixed(3), {
          imageSrc: cardImagePath('/cards/first_agenda.png'),
        }),
      )
      .withAct(
        instanceId('first_act'),
        blankAct('first_act', { imageSrc: cardImagePath('/cards/first_act.png') }),
      )
      .start();

    const board = boardView(context, state);

    expect(board.agenda?.image).toBe('/cards/first_agenda.png');
    expect(board.act?.image).toBe('/cards/first_act.png');
  });

  it('has neither on a table without them', () => {
    const { context, state } = newGame().withLocation(study, blankLocation('study')).start();

    const board = boardView(context, state);

    expect(board.agenda).toBeUndefined();
    expect(board.act).toBeUndefined();
  });
});

describe('decisions and attacks', () => {
  const ghoulOnAlice = newGame()
    .withLocation(study, blankLocation('study', { shroud: 1 }), { revealed: true })
    .withInvestigator(alice, { locationId: study })
    .withCard(
      instanceId('ghoul'),
      blankEnemy('ghoul', { damage: 1, horror: 2 }),
      engagedWith(alice),
    );

  it('reads an open decision with the card it is about and its default counts', () => {
    const { context, state } = ghoulOnAlice.withTurnOf(alice).start();
    const investigating = stateAfter(context, state, {
      type: 'Investigate',
      investigatorId: alice,
      asAction: true,
    });

    const { decisions } = boardView(context, investigating);

    expect(decisions).toEqual([
      {
        prompt: 'decision.attackOfOpportunity',
        kind: 'confirm',
        about: 'ghoul',
        for: alice,
        options: ['attack', 'does not provoke'],
        defaults: { attack: { damage: 1, horror: 2 } },
      },
    ]);
  });

  it('reads no decisions when none is open', () => {
    const { context, state } = ghoulOnAlice.start();

    expect(boardView(context, state).decisions).toEqual([]);
  });

  it('lists the attacks of the enemy phase only while step 3.3 waits for them', () => {
    const { context, state } = ghoulOnAlice.start();
    const afterTurn = stateAfter(
      context,
      state,
      { type: 'NextPhase' },
      { type: 'StartTurn', investigatorId: alice },
      { type: 'EndTurn', investigatorId: alice },
    );

    const enemyPhase = boardView(context, stateAfter(context, afterTurn, { type: 'NextPhase' }));

    expect(enemyPhase).toMatchObject({ phase: 'enemy', step: 'enemiesAttack' });
    expect(enemyPhase.attacksDue).toEqual([{ enemy: 'ghoul', investigator: alice }]);
    expect(boardView(context, afterTurn).attacksDue).toEqual([]);
  });
});

describe('a decision with one adjustable amount', () => {
  it('reads the default of the option amount', () => {
    const { context, state } = newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(alice, { locationId: study })
      .start();
    const asked = stateAfter(context, state, {
      type: 'RequestDecision',
      decision: {
        id: decisionId('discover_clues'),
        kind: 'confirm',
        prompt: 'decision.confirm',
        decider: { kind: 'lead' },
        options: [
          {
            id: 'discover',
            label: 'discover',
            commands: [],
            amount: { default: 2, min: 0, max: 3 },
          },
        ],
      },
    });

    expect(boardView(context, asked).decisions[0]?.defaults).toEqual({ discover: { amount: 2 } });
  });
});

describe('TableError', () => {
  it('ends its message with the board', () => {
    const { context, state } = newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(alice, { locationId: study })
      .start();

    expect(() => boardView(context, state).investigator(bob)).toThrow(
      /^no investigator with id bob\nRound 0, setup phase/,
    );
  });
});

describe('namesIn', () => {
  it('lists the names of the cards in a zone, top first', () => {
    const { context, state } = newGame()
      .withLocation(study, blankLocation('study'))
      .withCard(instanceId('top_card'), blankTreachery('top_card'), { kind: 'encounterDeck' })
      .withCard(instanceId('second_card'), blankTreachery('second_card'), { kind: 'encounterDeck' })
      .start();
    const board = boardView(context, state);

    expect(board.namesIn({ kind: 'encounterDeck' })).toEqual(['top_card', 'second_card']);
    expect(board.namesIn({ kind: 'encounterDiscard' })).toEqual([]);
  });
});
