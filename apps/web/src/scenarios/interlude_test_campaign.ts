import { nightOfTheZealot } from '@arkham/scenarios';
import { campaignDefinitionId, cardCode, interludeId, scenarioId } from '@arkham/engine';
import type { CampaignEntry } from './scenarioCatalog';

/**
 * A campaign for the end-to-end tests only (`vite build --mode e2e`, `findCampaign`): Night of the
 * Zealot's scenarios with an invented interlude after The Gathering, since no campaign the app
 * plays has an interlude yet. The app's own build leaves it out, and the wizard never offers it;
 * the tests store its log directly. Its words are in `i18n/en/interlude_test.ts`.
 */
export const interludeTestCampaign: CampaignEntry = {
  id: 'interlude-test',
  nameKey: 'campaigns.interludeTest',
  definition: {
    ...nightOfTheZealot,
    id: campaignDefinitionId('interlude-test'),
    interludes: [
      {
        id: interludeId('a-sleepless-night'),
        afterScenario: scenarioId('the-gathering'),
        steps: [
          {
            kind: 'decide',
            questionKey: 'story.interludeTest.where.question',
            options: [
              {
                labelKey: 'story.interludeTest.where.rest',
                steps: [{ kind: 'awardXp', to: 'each', amount: 1 }],
              },
              {
                labelKey: 'story.interludeTest.where.pressOn',
                steps: [
                  {
                    kind: 'record',
                    key: 'pressedOn',
                    value: { kind: 'flag', value: true },
                  },
                  { kind: 'awardXp', to: 'each', amount: 2 },
                  { kind: 'earnCard', to: 'chosen', card: cardCode('01117') },
                  { kind: 'addChaosToken', token: 'cultist' },
                  { kind: 'byHand', textKey: 'story.interludeTest.shuffleDecks' },
                ],
              },
            ],
          },
        ],
      },
    ],
    log: { notes: ['pressedOn'], sheets: [] },
  },
  storyKey: 'story.interludeTest',
  packCodes: ['core', 'rcore'],
};
