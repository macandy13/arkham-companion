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
        prompt: 'Resolution 1: read it aloud, then the lead investigator must decide',
        stay: 'Stay and fight the fire!',
        go: '"There\'s no time. We have to go."',
      },
      resolution: {
        earnArmitage:
          'The investigator who earned Dr. Henry Armitage adds him to their deck, ignoring deckbuilding restrictions; he does not count toward its size.',
        upgradeDecks: 'Each investigator spends experience on deck upgrades.',
      },
    },
    smokeAndMirrors: {
      resolution: {
        drawForTheHarbinger:
          "Gather each Elite enemy in play and/or beneath a location when the scenario ended, shuffle them facedown with the harbinger of Elokoss and draw one at random: if it is the harbinger, the investigators discovered the cult's whereabouts.",
        upgradeDecks: 'Each investigator spends experience on deck upgrades.',
      },
    },
  },
  scenarios: { spreadingFlames: 'Spreading Flames', smokeAndMirrors: 'Smoke and Mirrors' },
  campaigns: {},
  story: {},
} satisfies CampaignTexts;
