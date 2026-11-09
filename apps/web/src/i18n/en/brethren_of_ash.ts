import type { CampaignTexts } from '../index';

/** Brethren of Ash's English strings (the Core Set (2026) campaign): its name, scenarios, scenario choices and story records. */
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
  campaigns: { brethrenOfAsh: 'Brethren of Ash' },
  // The campaign notes in our own words, not the campaign guide's.
  story: {
    brethrenOfAsh: {
      savedMiskatonicUniversity: {
        yes: 'You saved Miskatonic University from the fire.',
        no: 'Miskatonic University burned.',
      },
      defeatedTheirMaskedPursuer: { yes: 'You defeated the masked figure hunting you.' },
      discoveredTheCultsWhereabouts: {
        yes: 'You found out where the cult is hiding.',
        no: 'Your search for the cult came to nothing.',
      },
      killedTheServantOfFlame: { yes: 'You killed the Servant of Flame.' },
      theServantOfFlameEscaped: { yes: 'The Servant of Flame got away.' },
      scouredArkhamForAnswers: { yes: 'You searched all of Arkham for answers.' },
      stirredUpTrouble: { yes: 'You stirred up trouble across Arkham.' },
      harbingerOfElokoss: 'Harbinger of Elokoss',
    },
  },
} satisfies CampaignTexts;
