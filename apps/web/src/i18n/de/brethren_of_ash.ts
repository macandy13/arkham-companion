import type { CampaignTexts } from '../index';

/** Brethren of Ash's German strings (the Core Set (2026) campaign): its scenario choices so far. */
export const brethrenOfAshTexts = {
  scenario: {
    spreadingFlames: {
      cosmicEvils: {
        prompt: '{{card}}: Du musst entweder',
        doom: '1 Verderben auf die aktuelle Agenda legen',
        wounds: '1 direkten Schaden und 1 direkten Horror erleiden; die Karte erhält Nachrücken',
      },
    },
  },
  scenarios: {},
  campaigns: {},
  story: {},
} satisfies CampaignTexts;
