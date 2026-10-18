import { describe, expect, it } from 'vitest';
import {
  atLocation,
  attachedTo,
  blankAct,
  blankAgenda,
  blankAsset,
  blankEnemy,
  blankLocation,
  blankTreachery,
  boardView,
  engagedWith,
  fixed,
  instanceId,
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
        damage: 3,
        horror: 1,
        actions: 3,
        threatArea: ['frozen_in_fear'],
      },
      expect.objectContaining({ id: bob, clues: 0 }),
    ]);
    expect(investigators[1]).not.toHaveProperty('at');
    expect(investigators[1]).not.toHaveProperty('threatArea');
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
    expect(() => board.investigator(bob)).toThrow(/no investigator bob\nRound 0, setup phase/);
  });
});

describe('locations', () => {
  const house = newGame()
    .withLocation(study, blankLocation('study', { clues: fixed(2) }), { revealed: true })
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

  it('leaves out locations that are not on a map', () => {
    const { context, state } = house
      .withCard(instanceId('cellar'), blankLocation('cellar'), { kind: 'setAside' })
      .start();

    const names = boardView(context, state).locations.map((location) => location.name);

    expect(names).toEqual(['study', 'hallway', 'attic']);
  });

  it('finds a location by name or by id', () => {
    const { context, state } = house.start();
    const board = boardView(context, state);

    expect(board.location('study').id).toBe(study);
    expect(board.location('Study').id).toBe(study);
    expect(board.location('hallway').id).toBe(hallway);
    expect(board.location(hallway).name).toBe('hallway');
  });

  it('fails with the board for a location that is not in play', () => {
    const { context, state } = house
      .withCard(instanceId('cellar'), blankLocation('cellar'), { kind: 'setAside' })
      .start();
    const board = boardView(context, state);

    expect(() => board.location('cellar')).toThrow(/no location cellar in play\nRound 0/);
    expect(() => board.location('garden')).toThrow(TableError);
  });

  it('fails and lists the ids when several locations share a name', () => {
    const cellar = blankLocation('cellar');
    const { context, state } = newGame()
      .withLocation(instanceId('cellar_east'), cellar)
      .withLocation(instanceId('cellar_west'), cellar)
      .start();
    const board = boardView(context, state);

    expect(() => board.location('cellar')).toThrow(
      /2 locations are named cellar; use one of cellar_east, cellar_west\nRound 0/,
    );
    expect(board.location(instanceId('cellar_west')).id).toBe('cellar_west');
  });
});

describe('enemies', () => {
  it('reads each enemy in play with where it is and what is on it', () => {
    const ghoul = blankEnemy('ghoul');
    const { context, state } = newGame()
      .withLocation(study, blankLocation('study'))
      .withLocation(hallway, blankLocation('hallway'))
      .withInvestigator(alice, { locationId: study })
      .withCard(instanceId('lurker'), blankEnemy('lurker'), atLocation(hallway))
      .withCard(instanceId('ghoul'), ghoul, engagedWith(alice), { tokens: { damage: 2 } })
      .withCard(instanceId('set_aside_ghoul'), ghoul, { kind: 'setAside' })
      .start();

    const { enemies } = boardView(context, state);

    expect(enemies).toEqual([
      { id: instanceId('lurker'), name: 'lurker', at: 'hallway' },
      { id: instanceId('ghoul'), name: 'ghoul', at: 'study', engagedWith: alice, damage: 2 },
    ]);
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
    const rat = blankEnemy('rat');
    const ghoul = blankEnemy('ghoul');
    const rats = newGame()
      .withLocation(study, blankLocation('study'))
      .withLocation(hallway, blankLocation('hallway'))
      .withInvestigator(alice, { locationId: study })
      .withInvestigator(bob, { locationId: study })
      .withCard(instanceId('rat_on_alice'), rat, engagedWith(alice))
      .withCard(instanceId('rat_on_bob'), rat, engagedWith(bob))
      .withCard(instanceId('rat_in_hallway'), rat, atLocation(hallway))
      .withCard(instanceId('ghoul'), ghoul, atLocation(study));

    it.each([
      { selector: 'ghoul', found: 'ghoul' },
      { selector: 'Ghoul', found: 'ghoul' },
      { selector: instanceId('rat_in_hallway'), found: 'rat_in_hallway' },
      { selector: { name: 'rat', engagedWith: alice }, found: 'rat_on_alice' },
      { selector: { name: 'rat', engagedWith: bob }, found: 'rat_on_bob' },
      { selector: { name: 'rat', at: 'hallway' }, found: 'rat_in_hallway' },
      { selector: { name: 'rat', at: hallway }, found: 'rat_in_hallway' },
      { selector: { name: 'rat', engagedWith: alice, at: 'study' }, found: 'rat_on_alice' },
    ])('finds $found with $selector', ({ selector, found }) => {
      const { context, state } = rats.start();

      expect(boardView(context, state).enemy(selector).id).toBe(found);
    });

    it('fails and says how to narrow when several enemies match', () => {
      const { context, state } = rats.start();
      const board = boardView(context, state);

      expect(() => board.enemy('rat')).toThrow(
        /3 enemies match "rat" \(rat_on_alice, rat_on_bob, rat_in_hallway\); narrow it with \{ name, engagedWith \} or \{ name, at \}.*\nRound 0/,
      );
      expect(() => board.enemy({ name: 'rat', at: 'study' })).toThrow(/2 enemies match/);
    });

    it.each([
      { selector: 'goblin', message: 'no enemy in play matching "goblin"' },
      { selector: { name: 'ghoul', engagedWith: alice }, message: 'no enemy in play matching' },
      { selector: { name: 'ghoul', at: 'hallway' }, message: 'no enemy in play matching' },
    ])('fails with the board when $selector matches nothing', ({ selector, message }) => {
      const { context, state } = rats.start();

      expect(() => boardView(context, state).enemy(selector)).toThrow(
        new RegExp(`${message}[^]*Round 0`),
      );
    });

    it('fails when the location of the selector is not in play', () => {
      const { context, state } = rats.start();

      expect(() => boardView(context, state).enemy({ name: 'rat', at: 'cellar' })).toThrow(
        /no location cellar in play/,
      );
    });

    it('does not find an enemy outside play', () => {
      const { context, state } = rats
        .withCard(instanceId('stored_goblin'), blankEnemy('goblin'), { kind: 'setAside' })
        .start();

      expect(() => boardView(context, state).enemy('goblin')).toThrow(TableError);
    });
  });
});

describe('agenda and act', () => {
  it('reads the current agenda with its doom and the current act with its clue requirement', () => {
    const { context, state } = newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(alice, { locationId: study })
      .withInvestigator(bob, { locationId: study })
      .withAgenda(instanceId('first_agenda'), blankAgenda('first_agenda', fixed(3)))
      .withAct(instanceId('first_act'), blankAct('first_act', { clues: perInvestigator(2) }))
      .start();

    const board = boardView(context, stateAfter(context, state, { type: 'PlaceDoom', amount: 2 }));

    expect(board.agenda).toEqual({ name: 'first_agenda', doom: 2 });
    expect(board.act).toEqual({ name: 'first_act', clues: 4 });
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
    const { context, state } = ghoulOnAlice.start();
    const investigating = stateAfter(
      context,
      state,
      { type: 'NextPhase' },
      { type: 'StartTurn', investigatorId: alice },
      { type: 'Investigate', investigatorId: alice },
    );

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
