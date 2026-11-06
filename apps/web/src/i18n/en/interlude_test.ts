import type { CampaignTexts } from '../index';

/** The words of the end-to-end tests' interlude campaign (`interludeTestCampaign`), English only. */
export const interludeTestTexts = {
  campaigns: { interludeTest: 'Interlude test campaign' },
  scenarios: {},
  scenario: {},
  story: {
    interludeTest: {
      interludes: { 'a-sleepless-night': 'A Sleepless Night' },
      where: {
        question: 'How do the investigators spend the night?',
        rest: 'Rest until dawn',
        pressOn: 'Press on through the night',
      },
      pressedOn: { yes: 'The investigators pressed on through the night.' },
      shuffleDecks: 'Each investigator shuffles their discard pile into their deck.',
    },
  },
} satisfies CampaignTexts;
