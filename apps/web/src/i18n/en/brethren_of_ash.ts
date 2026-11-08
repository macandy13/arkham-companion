import type { CampaignTexts } from '../index';

/** Brethren of Ash's English strings (the Core Set (2026) campaign): its scenarios and their choices so far. */
export const brethrenOfAshTexts = {
  scenario: {
    spreadingFlames: {
      cosmicEvils: {
        prompt: '{{card}}: you must either',
        doom: 'Place 1 doom on the current agenda',
        wounds: 'Take 1 direct damage and 1 direct horror; Cosmic Evils gains surge',
      },
      stayOrGo: {
        prompt: 'The lead investigator must decide',
        stay: 'Stay and fight the fire!',
        go: '"There\'s no time. We have to go."',
      },
      resolution: {
        earnArmitage:
          'The investigator who earned Dr. Henry Armitage adds him to their deck, ignoring deckbuilding restrictions; he does not count toward its size.',
        upgradeDecks: 'Each investigator spends experience on deck upgrades.',
      },
    },
  },
  scenarios: { spreadingFlames: 'Spreading Flames' },
  campaigns: {},
  story: {},
} satisfies CampaignTexts;
