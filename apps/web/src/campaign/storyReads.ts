import type { TFunction } from 'i18next';
import { assertNever } from '@arkham/util';
import {
  resolveAmount,
  type CardCode,
  type CampaignLog,
  type SetupStep,
  type StoryCondition,
  type StoryRead,
} from '@arkham/engine';
import { scenarioCardName } from '../scenarios/scenarioCatalog';
import { flagNoteKey } from './CampaignSheets';

/** A story read of the next scenario's setup in the players' words, for the setup preview. */
export interface StoryReadLine {
  /** What the log says, such as "The Ghoul Priest is still out there." */
  readonly entry: string;
  /** What the setup does for it, such as "The Ghoul Priest is shuffled into the encounter deck". */
  readonly effects: readonly string[];
}

/**
 * The lines of the setup preview's "From the campaign log" (MC1.6d2): each read of `reads` that
 * changes the setup in a way the players see, with the log's words for its entry and the setup's
 * words for its steps. A read that takes no step, or only steps the players need no word on
 * (the map, the encounter deck), is left out, as is a flag side the log page shows no note for.
 * `storyKey` is the campaign's `CampaignEntry.storyKey`.
 */
export function storyReadLines(
  t: TFunction,
  exists: (key: string) => boolean,
  storyKey: string,
  log: CampaignLog,
  reads: readonly StoryRead[],
): StoryReadLine[] {
  return reads.flatMap((read) => {
    const effects = read.steps.flatMap((step) => stepWords(t, log, step));
    const entry = entryWords(t, exists, storyKey, read.condition, read.holds);
    return effects.length > 0 && entry !== undefined ? [{ entry, effects }] : [];
  });
}

function entryWords(
  t: TFunction,
  exists: (key: string) => boolean,
  storyKey: string,
  condition: StoryCondition,
  holds: boolean,
): string | undefined {
  switch (condition.kind) {
    case 'flag': {
      const key = flagNoteKey(storyKey, condition.key, holds === condition.value);
      return exists(key) ? t(key) : undefined;
    }
    case 'atLeastNames':
      return t(`nextScenario.atLeastNames.${holds ? 'yes' : 'no'}`, {
        count: condition.count,
        heading: t(`${storyKey}.${condition.key}`),
      });
    case 'listsName':
      return t(`nextScenario.listsName.${holds ? 'yes' : 'no'}`, {
        name: condition.name,
        heading: t(`${storyKey}.${condition.key}`),
      });
    default:
      return assertNever(condition);
  }
}

/** A setup step in the players' words, or none for steps they need no word on. */
function stepWords(t: TFunction, log: CampaignLog, step: SetupStep): string[] {
  switch (step.kind) {
    case 'moveInvestigators':
      return [t('nextScenario.steps.start', { location: scenarioCardName(step.to) })];
    case 'shuffleIntoEncounterDeck':
      return [
        t('nextScenario.steps.shuffleIn', {
          cards: cardNames(step.codes),
          count: step.codes.length,
        }),
      ];
    case 'setAside':
      return [
        t('nextScenario.steps.setAside', {
          cards: cardNames(step.codes),
          count: step.codes.length,
        }),
      ];
    case 'placeTokens':
      return [
        t(`nextScenario.steps.tokens.${step.token}`, {
          count: resolveAmount(step.amount, log.investigators.length),
          card: scenarioCardName(step.target),
        }),
      ];
    case 'spawn':
      return [
        t('nextScenario.steps.spawn', {
          card: scenarioCardName(step.code),
          location: scenarioCardName(step.at),
        }),
      ];
    case 'addChaosTokens':
      return [
        t('nextScenario.steps.chaosTokens', {
          tokens: step.tokens.map((token) => t(`chaosToken.${token}`)).join(', '),
        }),
      ];
    // Nested branches have reads of their own; the rest build the table the players set up
    // the same in every campaign, so the preview needs no word on them.
    case 'whenStory':
    case 'whenPlayers':
    case 'oneAtRandom':
    case 'addMap':
    case 'buildEncounterDeck':
    case 'scenarioDeck':
    case 'shuffle':
      return [];
    default:
      return assertNever(step);
  }
}

function cardNames(codes: readonly CardCode[]): string {
  return codes.map(scenarioCardName).join(', ');
}
