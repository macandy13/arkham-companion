import type { CampaignTexts } from '../index';

/** Brethren of Ash's English strings (the Core Set (2026) campaign): its scenario choices so far. */
export const brethrenOfAshTexts = {
  scenario: {
    spreadingFlames: {
      cosmicEvils: {
        prompt: '{{card}}: you must either',
        doom: 'Place 1 doom on the current agenda',
        wounds: 'Take 1 direct damage and 1 direct horror; Cosmic Evils gains surge',
      },
    },
  },
  scenarios: {},
  campaigns: {},
  story: {},
} satisfies CampaignTexts;
