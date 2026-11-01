import type { CampaignTexts } from '../index';

/** Night of the Zealot's English strings: its name, scenarios, scenario choices and story records. */
export const nightOfTheZealotTexts = {
  scenario: {
    theGathering: {
      whatsGoingOn: {
        prompt: 'The lead investigator must decide',
        discard: 'Each investigator discards 1 random card from their hand',
        horror: 'The lead investigator takes 2 horror',
      },
      burnTheHouse: {
        prompt: 'The lead investigator must decide',
        burn: 'Burn the house to the ground',
        spare: 'Leave the house standing',
      },
      resolution: {
        earnLita:
          'The lead investigator may include Lita Chantler in their deck; she does not count toward its size.',
        upgradeDecks: 'Each investigator spends experience on deck upgrades.',
        replaceKilled:
          "Each killed investigator's player picks a new investigator for the next scenario. If no investigators are left to choose, the campaign is over and the players lose.",
        earnLitaIfLeadKilled:
          'If nobody resigned, choose one of the new investigators to earn Lita Chantler. Whoever earned her may include her in their deck; she does not count toward its size.',
      },
    },
    theMidnightMasks: {
      graveyard: {
        prompt: '{{card}}: you must either',
        horror: 'Take 2 horror',
        rivertown: 'Move to Rivertown',
      },
      huntingShadow: {
        prompt: '{{card}}: you must either',
        clue: 'Spend 1 clue',
        damage: 'Take 2 damage',
      },
      resolution: {
        upgradeDecks: 'Each investigator spends experience on deck upgrades.',
      },
    },
    theDevourerBelow: {
      offerOfPower: {
        prompt: '{{card}}: you must either',
        doom: 'Draw 2 cards and place 2 doom on the current agenda',
        horror: 'Take 2 horror',
      },
      quietGlade: {
        prompt: '{{card}}: heal 1 damage or 1 horror',
        damage: 'Heal 1 damage',
        horror: 'Heal 1 horror',
      },
      resolution: {
        upgradeDecks: 'Each investigator spends experience on deck upgrades.',
        removeLita: 'Remove Lita Chantler from the deck that holds her.',
        madnessWeakness: 'Each investigator adds a random Madness weakness to their deck.',
      },
    },
  },
  scenarios: {
    theGathering: 'The Gathering',
    theMidnightMasks: 'The Midnight Masks',
    theDevourerBelow: 'The Devourer Below',
  },
  campaigns: { nightOfTheZealot: 'Night of the Zealot' },
  // The campaign notes in our own words, not the campaign guide's.
  story: {
    nightOfTheZealot: {
      houseStillStanding: {
        yes: 'Your house is still standing.',
        no: 'Your house burned to the ground.',
      },
      ghoulPriestStillAlive: { yes: 'The Ghoul Priest is still out there.' },
      litaForcedToFindOthers: { yes: 'Lita had to look for help elsewhere.' },
      itIsPastMidnight: { yes: 'It was past midnight.' },
      arkhamSuccumbed: { yes: "Arkham fell to Umôrdhoth's vengeance." },
      ritualBroken: { yes: 'You broke the ritual to summon Umôrdhoth.' },
      umordhothRepelled: { yes: 'You drove Umôrdhoth back.' },
      litaSacrificed: { yes: 'You gave Lita Chantler to Umôrdhoth.' },
      cultistsWeInterrogated: 'Cultists We Interrogated',
      cultistsWhoGotAway: 'Cultists Who Got Away',
    },
  },
} as const satisfies CampaignTexts;
