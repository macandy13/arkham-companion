import {
  GRID_CELLS_PER_CARD,
  CommandRejected,
  cardStats,
  scenario,
  decisionId,
  enemiesAt,
  mapId,
  matchesEncounter,
  scenarioId,
  trait,
  type AddMapStep,
  type CardCode,
  type CardInstance,
  type Command,
  type EncounterMatch,
  type EngineContext,
  type EnemyDefeated,
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
 * The Gathering's resolutions, as the campaign guide numbers them: R1 the
 * house is burned down, R2 it is left standing (both from act 3), R3 the
 * investigators are trapped in the house (agenda 3 before act 3).
 */
export const GATHERING_RESOLUTIONS = {
  burnedDown: 'R1',
  leftStanding: 'R2',
  trapped: 'R3',
} as const;

const resolutions = GATHERING_RESOLUTIONS;

/** Id of act 3's question to the lead investigator: burn the house down or not. */
export const BURN_THE_HOUSE_DECISION = decisionId('theGathering.burnTheHouse');

const ghoulEnemy: EncounterMatch = { trait: trait('Ghoul'), typeCode: 'enemy' };

/** One card step on the layout grid, which is finer than a card. */
const oneCard = GRID_CELLS_PER_CARD;

/**
 * The house as act 1 ("Trapped") reveals it: the Hallway connects to the
 * Attic, the Cellar and the Parlor. The campaign guide gives no placement for
 * this scenario, so the cells are our own: a star around the Hallway, with the
 * Attic above it, the Cellar below it and the Parlor to its right, each one card
 * step away. Not part of `theGathering.setup`: these
 * locations start set aside, and act 1's reverse side (`trappedReverseSide`)
 * puts them into play with `compileMapStep`.
 */
export const theGatheringHouse: AddMapStep = {
  kind: 'addMap',
  mapId: mapId('house'),
  name: 'House',
  locations: [
    { code: codes.hallway, at: { column: 0, row: oneCard } },
    { code: codes.attic, at: { column: 0, row: 0 } },
    { code: codes.cellar, at: { column: 0, row: 2 * oneCard } },
    { code: codes.parlor, at: { column: oneCard, row: oneCard } },
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
    ...scenario.compileMapStep(state, theGatheringHouse),
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
 * Act 3 ("What Have You Done?"), objective: once the Ghoul Priest is
 * defeated, the act advances by itself. The Priest only enters play on act
 * 2's reverse side, but the current act is checked anyway, so a Priest
 * defeated by a correction later on cannot advance a used-up act deck.
 */
function ghoulPriestDefeated(
  _ctx: EngineContext,
  state: GameState,
  event: EnemyDefeated,
): Command[] {
  const enemy = state.cards[event.enemyId];
  const act = state.act.current === undefined ? undefined : state.cards[state.act.current];
  if (enemy?.code !== codes.ghoulPriest || act?.code !== codes.whatHaveYouDone) return [];
  return [{ type: 'AdvanceAct' }];
}

/**
 * Act 3, reverse side: the lead investigator decides whether to burn the
 * house down (R1) or leave it standing (R2). The decision has no `subject`:
 * one about the act would be dropped as the act leaves play.
 */
function whatHaveYouDoneReverseSide(): Command[] {
  const prefix = 'scenario.theGathering.burnTheHouse';
  return [
    {
      type: 'RequestDecision',
      decision: {
        id: BURN_THE_HOUSE_DECISION,
        kind: 'chooseOption',
        prompt: `${prefix}.prompt`,
        decider: { kind: 'lead' },
        options: [
          {
            id: 'burn',
            label: `${prefix}.burn`,
            commands: [{ type: 'EndScenario', resolution: resolutions.burnedDown }],
          },
          {
            id: 'spare',
            label: `${prefix}.spare`,
            commands: [{ type: 'EndScenario', resolution: resolutions.leftStanding }],
          },
        ],
      },
    },
  ];
}

/**
 * Agenda 2 ("Rise of the Ghouls"), reverse side: the encounter discard is
 * shuffled into the deck, then cards are discarded from the top until a
 * Ghoul enemy turns up, which the lead investigator draws. Without any Ghoul
 * enemy left among those cards only the shuffle happens; the draw would
 * otherwise reject the whole advance.
 */
function riseOfTheGhoulsReverseSide(ctx: EngineContext, state: GameState): Command[] {
  const shuffle: Command = { type: 'ShuffleEncounterDiscard' };
  const lead = state.meta.leadInvestigator;
  const ghoulLeft = Object.values(state.cards).some(
    (card) =>
      (card.zone.kind === 'encounterDeck' || card.zone.kind === 'encounterDiscard') &&
      matchesEncounter(cardStats(ctx.cards, card.code), ghoulEnemy),
  );
  if (lead === undefined || !ghoulLeft) return [shuffle];
  return [
    shuffle,
    { type: 'DrawEncounter', investigatorId: lead, match: ghoulEnemy, discardSkipped: true },
  ];
}

/**
 * Agenda 3 ("They're Getting Out!"), reverse side. Before act 3 the
 * investigators are trapped in the house (R3). At act 3 each investigator who
 * has not resigned is defeated, which leaves nobody in the scenario, so it
 * ends without a resolution. The lead goes last: defeating them while others
 * remain would ask for a new lead nobody can answer once the scenario is over.
 * The physical trauma the card adds is the campaign's to record (M1C).
 */
function theyreGettingOutReverseSide(_ctx: EngineContext, state: GameState): Command[] {
  const act = state.act.current === undefined ? undefined : state.cards[state.act.current];
  if (act?.code !== codes.whatHaveYouDone)
    return [{ type: 'EndScenario', resolution: resolutions.trapped }];
  const lead = state.meta.leadInvestigator;
  const active = state.investigators.filter((inv) => inv.status === 'active');
  const leadLast = [
    ...active.filter((inv) => inv.id !== lead),
    ...active.filter((inv) => inv.id === lead),
  ];
  return leadLast.map((inv): Command => ({ type: 'DefeatInvestigator', investigatorId: inv.id }));
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
function onlyCard(state: GameState, code: CardCode): CardInstance {
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
 * scenario for the generic rules until real scenario data arrives (M4).
 * Act 2's reverse side is an ability on its card data; `hooks` hold the
 * reverse sides of acts 1 and 3 and of agendas 2 and 3 and act 3's
 * objective (agenda 1's choice and agenda 3's forced effects are left to the
 * players). Pass the whole definition as `EngineContext.scenario`, so the
 * engine gets the hooks together with `reference` and `modifiers` (the
 * skull's "-X") for skill test suggestions. The reference
 * card's modifiers are hand-entered from the 2016 Core Set card as known
 * (Easy/Standard: skull -X, cultist -1, tablet -2; Hard/Expert: skull -2,
 * cultist reveals another token, tablet -4), not checked against a source.
 */
export const theGathering: ScenarioDefinition = {
  id: scenarioId('the-gathering'),
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
    {
      kind: 'addMap',
      mapId: mapId('study'),
      name: 'Study',
      locations: [{ code: codes.study, at: { column: 0, row: 0 } }],
    },
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
    onActAdvance: {
      [codes.trapped]: trappedReverseSide,
      [codes.whatHaveYouDone]: whatHaveYouDoneReverseSide,
    },
    onAgendaAdvance: {
      [codes.riseOfTheGhouls]: riseOfTheGhoulsReverseSide,
      [codes.theyreGettingOut]: theyreGettingOutReverseSide,
    },
    afterEnemyDefeated: ghoulPriestDefeated,
  },
  modifiers: { tokenValues: { skull: ghoulsAtYourLocation } },
};
