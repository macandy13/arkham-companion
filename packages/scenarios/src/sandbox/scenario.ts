import { mapId, type ScenarioDefinition } from '@arkham/engine';
import { SANDBOX_HAZARDS_SET, SANDBOX_SET } from './cards';

const house = mapId('house');

/**
 * A small invented scenario that exercises every generic rule with fake cards
 * (`sandboxCardDefs`): five locations in play and a hidden one set aside,
 * a spawned enemy carrying doom, a set-aside elite, a one-way connection and
 * an encounter deck built from two sets. Engine tests play it end to end, and
 * the web app can start it before any real scenario exists.
 */
export const sandboxScenario: ScenarioDefinition = {
  id: 'sandbox',
  chaosBag: {
    easy: ['+1', '+1', '0', '0', '-1', '-1', '-2', 'skull', 'cultist', 'autoFail', 'elderSign'],
    standard: ['+1', '0', '0', '-1', '-1', '-2', '-3', 'skull', 'cultist', 'autoFail', 'elderSign'],
    hard: ['0', '-1', '-1', '-2', '-3', '-4', '-5', 'skull', 'cultist', 'autoFail', 'elderSign'],
    expert: ['0', '-1', '-2', '-3', '-4', '-5', '-6', 'skull', 'cultist', 'autoFail', 'elderSign'],
  },
  agendaDeck: ['SB-A1', 'SB-A2'],
  actDeck: ['SB-C1', 'SB-C2'],
  setup: [
    { kind: 'addMap', mapId: house, name: 'House' },
    { kind: 'putIntoPlay', code: 'SB-L1', mapId: house },
    { kind: 'putIntoPlay', code: 'SB-L2', mapId: house },
    { kind: 'putIntoPlay', code: 'SB-L3', mapId: house },
    { kind: 'putIntoPlay', code: 'SB-L4', mapId: house },
    { kind: 'putIntoPlay', code: 'SB-L5', mapId: house },
    { kind: 'addConnection', from: 'SB-L1', to: 'SB-L2' },
    { kind: 'addConnection', from: 'SB-L1', to: 'SB-L3' },
    { kind: 'addConnection', from: 'SB-L1', to: 'SB-L5' },
    { kind: 'addConnection', from: 'SB-L2', to: 'SB-L4' },
    { kind: 'addConnection', from: 'SB-L3', to: 'SB-L5' },
    { kind: 'addConnection', from: 'SB-L4', to: 'SB-L3', oneWay: true },
    { kind: 'setAside', codes: ['SB-L6', 'SB-E4'] },
    { kind: 'spawn', code: 'SB-E3', at: 'SB-L3' },
    { kind: 'placeTokens', target: 'SB-E3', token: 'doom', amount: 1 },
    { kind: 'moveInvestigators', to: 'SB-L1' },
    { kind: 'buildEncounterDeck', sets: [SANDBOX_SET, SANDBOX_HAZARDS_SET] },
  ],
};
