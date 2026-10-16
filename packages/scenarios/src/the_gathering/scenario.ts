import {
  CommandRejected,
  cardStats,
  compileMapStep,
  enemiesAt,
  mapId,
  trait,
  type AddMapStep,
  type CardInstance,
  type Command,
  type EngineContext,
  type GameState,
  type ScenarioDefinition,
  type TokenValue,
} from '@arkham/engine';
import { GATHERING_CODES, GATHERING_SETS } from './cards';

const codes = GATHERING_CODES;
const sets = GATHERING_SETS;

/** Translation key prefix for The Gathering's reference card effects. */
const reference = 'scenario.theGathering.reference';

/**
 * The house as act 1 ("Trapped") reveals it: the Hallway connects to the
 * Attic, the Cellar and the Parlor. Not part of `theGathering.setup`: these
 * locations start set aside, and act 1's reverse side (`trappedReverseSide`)
 * puts them into play with `compileMapStep`.
 */
export const theGatheringHouse: AddMapStep = {
  kind: 'addMap',
  mapId: mapId('house'),
  name: 'House',
  locations: [
    { code: codes.hallway },
    { code: codes.attic },
    { code: codes.cellar },
    { code: codes.parlor },
  ],
  connections: [
    { from: codes.hallway, to: codes.attic },
    { from: codes.hallway, to: codes.cellar },
    { from: codes.hallway, to: codes.parlor },
  ],
};

/**
 * Act 1 ("Trapped"), reverse side: the house map (`theGatheringHouse`) is put
 * into play from the set-aside locations, the enemies in the Study are
 * discarded, every investigator moves to the Hallway (ignoring connections,
 * which reveals it), and the Study is removed from the game. Runs while act 1
 * is still current (`onActAdvance`). The commands are computed from one
 * snapshot but handled in order, so the Hallway is in play by the time the
 * investigators move.
 */
function trappedReverseSide(ctx: EngineContext, state: GameState): Command[] {
  const study = onlyCard(state, codes.study);
  const hallway = onlyCard(state, codes.hallway);
  const atStudy = state.investigators.filter(
    (inv) => inv.status === 'active' && inv.locationId === study.id,
  );
  // Engaged enemies are at their investigator's location, so they are in the Study too.
  const enemies = Object.values(state.cards).filter((card) => {
    const zone = card.zone;
    if (zone.kind === 'engaged') return atStudy.some((inv) => inv.id === zone.investigatorId);
    return (
      zone.kind === 'atLocation' &&
      zone.locationId === study.id &&
      cardStats(ctx.cards, card.code).typeCode === 'enemy'
    );
  });
  return [
    ...compileMapStep(state, theGatheringHouse),
    ...enemies.map((enemy): Command => ({
      type: 'MoveCard',
      cardId: enemy.id,
      to: { kind: 'encounterDiscard' },
    })),
    ...state.investigators
      .filter((inv) => inv.status === 'active')
      .map((inv): Command => ({
        type: 'MoveInvestigator',
        investigatorId: inv.id,
        to: hallway.id,
        ignoreConnections: true,
      })),
    { type: 'MoveCard', cardId: study.id, to: { kind: 'outOfGame' } },
  ];
}

/**
 * The skull token on Easy/Standard: -X, where X is the number of Ghoul
 * enemies at the testing investigator's location (engaged ones included,
 * since they are at that location too). The printed -2 of Hard/Expert comes
 * from `reference` and takes precedence.
 */
const ghoulsAtYourLocation: TokenValue = (ctx, state, test) => {
  if (test.locationId === undefined) return 0;
  const ghouls = enemiesAt(state, test.locationId).filter((enemy) =>
    cardStats(ctx.cards, enemy.code).traits.includes(trait('Ghoul')),
  );
  // Subtracting from 0 rather than negating keeps "no Ghouls" a plain 0, not -0, in the trace.
  return 0 - ghouls.length;
};

/** The one instance of `code` (the Gathering has a single copy of each location). */
function onlyCard(state: GameState, code: string): CardInstance {
  const card = Object.values(state.cards).find((candidate) => candidate.code === code);
  if (!card) throw new CommandRejected({ code: 'setupTargetNotFound', cardCode: code });
  return card;
}

/**
 * The Gathering (Core Set, 2016, scenario I of Night of the Zealot), set up as
 * the campaign guide describes: the Study is the only location in play, the
 * other locations, the Ghoul Priest and Lita Chantler are set aside, and the
 * rest of the six encounter sets is shuffled into the encounter deck. Card
 * data is hand-entered (`theGatheringCardDefs`); it is the shared test
 * scenario for the generic rules until real scenario data arrives (M4). Its
 * `hooks` hold act 1's reverse side; pass them as `EngineContext.hooks`, and
 * `reference` and `modifiers` (the skull's "-X") as `EngineContext.reference`
 * and `EngineContext.modifiers` for skill test suggestions. The reference
 * card's modifiers are hand-entered from the 2016 Core Set card as known
 * (Easy/Standard: skull -X, cultist -1, tablet -2; Hard/Expert: skull -2,
 * cultist reveals another token, tablet -4), not checked against a source.
 */
export const theGathering: ScenarioDefinition = {
  id: 'the-gathering',
  // Number tokens, then symbol tokens: easier to check against the guide than one token per line.
  // prettier-ignore
  chaosBag: {
    easy: [
      '+1', '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-2',
      'skull', 'skull', 'cultist', 'tablet', 'autoFail', 'elderSign',
    ],
    standard: [
      '+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4',
      'skull', 'skull', 'cultist', 'tablet', 'autoFail', 'elderSign',
    ],
    hard: [
      '0', '0', '0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-5',
      'skull', 'skull', 'cultist', 'tablet', 'autoFail', 'elderSign',
    ],
    expert: [
      '0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-4', '-5', '-6', '-8',
      'skull', 'skull', 'cultist', 'tablet', 'autoFail', 'elderSign',
    ],
  },
  reference: {
    easyStandard: {
      skull: { effectKey: `${reference}.easyStandard.skull` },
      cultist: { modifier: -1, effectKey: `${reference}.easyStandard.cultist` },
      tablet: { modifier: -2, effectKey: `${reference}.easyStandard.tablet` },
    },
    hardExpert: {
      skull: { modifier: -2, effectKey: `${reference}.hardExpert.skull` },
      cultist: { effectKey: `${reference}.hardExpert.cultist` },
      tablet: { modifier: -4, effectKey: `${reference}.hardExpert.tablet` },
    },
  },
  agendaDeck: [codes.whatsGoingOn, codes.riseOfTheGhouls, codes.theyreGettingOut],
  actDeck: [codes.trapped, codes.theBarrier, codes.whatHaveYouDone],
  setup: [
    { kind: 'addMap', mapId: mapId('study'), name: 'Study', locations: [{ code: codes.study }] },
    {
      kind: 'setAside',
      codes: [
        codes.hallway,
        codes.attic,
        codes.cellar,
        codes.parlor,
        codes.ghoulPriest,
        codes.litaChantler,
      ],
    },
    { kind: 'moveInvestigators', to: codes.study },
    { kind: 'buildEncounterDeck', sets: Object.values(sets) },
  ],
  hooks: {
    onActAdvance: { [codes.trapped]: trappedReverseSide },
  },
  modifiers: { tokenValues: { skull: ghoulsAtYourLocation } },
};
