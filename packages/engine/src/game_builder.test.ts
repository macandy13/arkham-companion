import { describe, expect, it } from 'vitest';
import {
  blankAct,
  blankAgenda,
  blankAsset,
  blankEnemy,
  blankLocation,
  attachedTo,
  atLocation,
  blankTreachery,
  cardCode,
  engagedWith,
  fixed,
  instanceId,
  investigatorId,
  mapId,
  newGame,
  perInvestigator,
  threatAreaOf,
  zoneKey,
  type SkillModifierRegistry,
  type ScenarioReference,
} from './index';
import { rejectionOf } from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const study = instanceId('study');
const hallway = instanceId('hallway');
const attic = instanceId('attic');

describe('blank cards', () => {
  it.each([
    {
      name: 'location',
      card: blankLocation('study'),
      stats: { typeCode: 'location', shroud: 0, clues: fixed(0) },
    },
    {
      name: 'enemy',
      card: blankEnemy('ghoul'),
      stats: { typeCode: 'enemy', fight: 0, evade: 0, health: fixed(1), damage: 0, horror: 0 },
    },
    {
      name: 'treachery',
      card: blankTreachery('curse'),
      stats: { typeCode: 'treachery' },
    },
    { name: 'asset', card: blankAsset('lantern'), stats: { typeCode: 'asset' } },
    {
      name: 'agenda',
      card: blankAgenda('agenda', fixed(3)),
      stats: { typeCode: 'agenda', stage: { number: 1 }, doom: fixed(3) },
    },
    {
      name: 'agenda without a doom threshold',
      card: blankAgenda('agenda', null),
      stats: { typeCode: 'agenda', stage: { number: 1 } },
    },
    {
      name: 'act',
      card: blankAct('act'),
      stats: { typeCode: 'act', stage: { number: 1 }, clues: fixed(0) },
    },
  ])('makes a $name with nothing on it, named after its code', ({ card, stats }) => {
    expect(card).toEqual({ code: card.code, name: card.code, traits: [], ...stats });
  });

  it('takes the stats a card sets over the blank ones', () => {
    expect(blankLocation('study', { name: 'Study', shroud: 3 })).toMatchObject({
      code: cardCode('study'),
      name: 'Study',
      shroud: 3,
      clues: fixed(0),
    });
  });
});

describe('newGame', () => {
  const studyCard = blankLocation('study', { clues: perInvestigator(2) });
  const hallwayCard = blankLocation('hallway');

  it('places locations unrevealed and without clues on the main map', () => {
    const { state } = newGame().withLocation(study, studyCard).start();

    expect(state.cards[study]).toMatchObject({
      zone: { kind: 'location', mapId: mapId('main') },
      faceUp: false,
      tokens: {},
    });
  });

  it.each([
    { name: 'the printed clues for the player count', options: { revealed: true }, clues: 4 },
    { name: 'the clues it is given', options: { revealed: true, clues: 1 }, clues: 1 },
  ])('puts $name on a revealed location', ({ options, clues }) => {
    const { state } = newGame()
      .withLocation(study, studyCard, options)
      .withInvestigator(alice)
      .withInvestigator(bob)
      .start();

    expect(state.cards[study]).toMatchObject({ faceUp: true, tokens: { clue: clues } });
  });

  it('puts each connection on the map of the location it starts at', () => {
    const upstairs = mapId('upstairs');
    const { state } = newGame()
      .withLocation(study, studyCard)
      .withLocation(hallway, hallwayCard)
      .withLocation(attic, blankLocation('attic'), { map: upstairs })
      .withConnection(study, hallway)
      .withConnection(attic, hallway, { oneWay: true })
      .start();

    expect(state.board.maps[mapId('main')]?.connections).toEqual([
      { from: study, to: hallway, oneWay: false },
    ]);
    expect(state.board.maps[upstairs]?.connections).toEqual([
      { from: attic, to: hallway, oneWay: true },
    ]);
  });

  it('puts a connection on the map it names, even one without locations', () => {
    const annex = mapId('annex');
    const { state } = newGame()
      .withLocation(study, studyCard)
      .withLocation(hallway, hallwayCard)
      .withMap(annex, { name: 'Annex', visible: false })
      .withConnection(study, hallway, { map: annex })
      .start();

    expect(state.board.maps[annex]).toEqual({
      name: 'Annex',
      visible: false,
      connections: [{ from: study, to: hallway, oneWay: false }],
      layout: {},
    });
    expect(state.board.maps[mapId('main')]?.connections).toEqual([]);
  });

  it('starts on the difficulty and with the seed it is given', () => {
    const { state } = newGame().withDifficulty('hard').withSeed(7).start();

    expect(state.meta).toMatchObject({ difficulty: 'hard', seed: 7 });
  });

  it('shuffles the encounter deck only when asked to', () => {
    const codes = ['curse', 'hex', 'omen', 'plague', 'rot', 'storm', 'void', 'wail'];
    const deck = codes.reduce(
      (game, code) =>
        game.withCard(instanceId(code), blankTreachery(code), { kind: 'encounterDeck' }),
      newGame(),
    );

    const shuffled = deck.withShuffledEncounterDeck().start().state;

    expect(deck.start().state.order[zoneKey({ kind: 'encounterDeck' })]).toEqual(codes);
    expect(shuffled.order[zoneKey({ kind: 'encounterDeck' })]).not.toEqual(codes);
    expect([...(shuffled.order[zoneKey({ kind: 'encounterDeck' })] ?? [])].sort()).toEqual(codes);
  });

  it('seats investigators in the order they are added, with what they are given', () => {
    const { state } = newGame()
      .withLocation(study, studyCard)
      .withInvestigator(alice, { locationId: study })
      .withInvestigator(bob, { clues: 2 })
      .start();

    expect(state.investigators).toMatchObject([
      { id: alice, seat: 0, locationId: study, clues: 0 },
      { id: bob, seat: 1, clues: 2 },
    ]);
  });

  it('keeps the cards of a zone in the order they are added, top first', () => {
    const top = instanceId('top_card');
    const below = instanceId('below_card');
    const { state } = newGame()
      .withCard(top, blankTreachery('curse'), { kind: 'encounterDeck' })
      .withCard(below, blankTreachery('hex'), { kind: 'encounterDeck' })
      .start();

    expect(state.order[zoneKey({ kind: 'encounterDeck' })]).toEqual([top, below]);
  });

  it.each([
    { name: 'at a location', zone: atLocation(study) },
    { name: 'engaged with an investigator', zone: engagedWith(alice) },
    { name: 'in a threat area', zone: threatAreaOf(alice) },
    { name: 'attached to a location', zone: attachedTo(study) },
  ])('places a card $name, face up and with tokens as given', ({ zone }) => {
    const lantern = instanceId('lantern_card');
    const { state } = newGame()
      .withLocation(study, studyCard)
      .withInvestigator(alice, { locationId: study })
      .withCard(lantern, blankAsset('lantern'), zone, {
        faceUp: true,
        tokens: { doom: 1 },
      })
      .start();

    expect(state.cards[lantern]).toMatchObject({ zone, faceUp: true, tokens: { doom: 1 } });
  });

  it('refuses a connection from an ID that is no location', () => {
    const table = newGame().withLocation(study, studyCard).withConnection(attic, study);

    expect(rejectionOf(() => table.start())).toEqual({ code: 'unknownCard', cardId: attic });
  });

  it('makes the first agenda and act added the current ones', () => {
    const firstAgenda = instanceId('first_agenda');
    const firstAct = instanceId('first_act');
    const { state } = newGame()
      .withAgenda(firstAgenda, blankAgenda('agenda_1', fixed(3)))
      .withAgenda(instanceId('second_agenda'), blankAgenda('agenda_2', fixed(5)))
      .withAct(firstAct, blankAct('act_1'))
      .start();

    expect(state.agenda.current).toBe(firstAgenda);
    expect(state.act.current).toBe(firstAct);
  });

  it('gives a context that knows every card on the table', () => {
    const ghoul = blankEnemy('ghoul');
    const { context } = newGame()
      .withLocation(study, studyCard)
      .withInvestigator(alice, { locationId: study })
      .withCard(instanceId('ghoul_card'), ghoul, engagedWith(alice))
      .start();

    expect(context.cards.get(cardCode('study'))).toBe(studyCard);
    expect(context.cards.get(cardCode('ghoul'))).toBe(ghoul);
  });

  it("starts in round 1's investigation phase with bob's turn begun for withTurnOf(bob)", () => {
    const { state } = newGame()
      .withLocation(study, studyCard, { revealed: true })
      .withInvestigator(alice, { locationId: study })
      .withInvestigator(bob, { locationId: study })
      .withTurnOf(bob)
      .start();

    expect(state.meta).toMatchObject({
      round: 1,
      phase: 'investigation',
      turn: { investigatorId: bob },
    });
  });

  it('gives a context without a scenario unless one of its rules is set', () => {
    expect(newGame().context().scenario).toBeUndefined();
  });

  it('gives a context playing a scenario with the reference card and modifiers given', () => {
    const modifiers: SkillModifierRegistry = { tokenValues: { skull: () => -1 } };
    const reference: ScenarioReference = {
      easyStandard: { skull: { modifier: -1, effectKey: 'test.skull' } },
      hardExpert: {},
    };

    const { scenario } = newGame()
      .withReferenceCard(reference)
      .withSkillModifiers(modifiers)
      .context();

    expect(scenario).toMatchObject({
      id: 'custom',
      reference,
      modifiers,
      agendaDeck: [],
      actDeck: [],
      setup: [],
    });
  });

  it('leaves the builder it extends unchanged, so tests can share a table', () => {
    const table = newGame().withLocation(study, studyCard);

    table.withLocation(hallway, hallwayCard);

    expect(Object.keys(table.start().state.cards)).toEqual([study]);
  });

  it('refuses two different definitions for one card code', () => {
    const table = newGame()
      .withLocation(study, studyCard)
      .withLocation(hallway, blankLocation('study'));

    expect(() => table.start()).toThrow('two different definitions for card code study');
  });
});
