import {
  cardStats,
  decisionId,
  enemiesAt,
  mapId,
  scenarioId,
  trait,
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

/**
 * The Gathering (Core Set, 2016, scenario I of Night of the Zealot), set up as
 * the campaign guide describes: the Study is the only location in play, the
 * other locations, the Ghoul Priest and Lita Chantler are set aside, and the
 * rest of the six encounter sets is shuffled into the encounter deck. Card
 * data is hand-entered (`theGatheringCardDefs`); it is the shared test
 * scenario for the generic rules until real scenario data arrives (M4).
 * The reverse sides of acts 1 and 2 and of agenda 2, and act 3's objective,
 * are abilities on their card data; `hooks` hold the reverse sides of act 3
 * and agenda 3 (agenda 1's choice and agenda 3's forced effects are left to
 * the players). Pass the whole definition as `EngineContext.scenario`, so the
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
      [codes.whatHaveYouDone]: whatHaveYouDoneReverseSide,
    },
    onAgendaAdvance: {
      [codes.theyreGettingOut]: theyreGettingOutReverseSide,
    },
  },
  modifiers: { tokenValues: { skull: ghoulsAtYourLocation } },
};
