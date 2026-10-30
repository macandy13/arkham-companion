import type { CampaignTexts } from '../index';

/** Night of the Zealot's German strings: its name, scenarios, scenario choices and story records. */
export const nightOfTheZealotTexts = {
  scenario: {
    theGathering: {
      whatsGoingOn: {
        prompt: 'Der Ermittlungsleiter muss entscheiden',
        discard: 'Jeder Ermittler wirft 1 zufällige Karte aus seiner Hand ab',
        horror: 'Der Ermittlungsleiter erleidet 2 Horror',
      },
      burnTheHouse: {
        prompt: 'Der Ermittlungsleiter muss entscheiden',
        burn: 'Das Haus niederbrennen',
        spare: 'Das Haus stehen lassen',
      },
    },
    theMidnightMasks: {
      graveyard: {
        prompt: '{{card}}: Du musst entweder',
        horror: '2 Horror erleiden',
        rivertown: 'Nach Rivertown bewegen',
      },
      huntingShadow: {
        prompt: '{{card}}: Du musst entweder',
        clue: '1 Hinweis ausgeben',
        damage: '2 Schaden erleiden',
      },
    },
    theDevourerBelow: {
      offerOfPower: {
        prompt: '{{card}}: Du musst entweder',
        doom: '2 Karten ziehen und 2 Verderben auf die aktuelle Agenda legen',
        horror: '2 Horror erleiden',
      },
      quietGlade: {
        prompt: '{{card}}: 1 Schaden oder 1 Horror heilen',
        damage: '1 Schaden heilen',
        horror: '1 Horror heilen',
      },
    },
  },
  scenarios: {
    theGathering: 'Die Zusammenkunft',
    theMidnightMasks: 'Die Mitternachtsmasken',
    theDevourerBelow: 'Der Verschlinger aus der Tiefe',
  },
  campaigns: { nightOfTheZealot: 'Die Nacht des Zeloten' },
  story: {
    nightOfTheZealot: {
      houseStillStanding: {
        yes: 'Euer Haus steht noch.',
        no: 'Euer Haus ist niedergebrannt.',
      },
      ghoulPriestStillAlive: { yes: 'Der Ghulpriester ist noch dort draußen.' },
      litaForcedToFindOthers: { yes: 'Lita musste sich anderswo Hilfe suchen.' },
      itIsPastMidnight: { yes: 'Es war nach Mitternacht.' },
      arkhamSuccumbed: { yes: 'Arkham fiel Umôrdhoths Rache zum Opfer.' },
      ritualBroken: { yes: 'Ihr habt das Ritual zur Beschwörung Umôrdhoths gebrochen.' },
      umordhothRepelled: { yes: 'Ihr habt Umôrdhoth zurückgeschlagen.' },
      litaSacrificed: { yes: 'Ihr habt Lita Chantler Umôrdhoth geopfert.' },
      cultistsWeInterrogated: 'Verhörte Kultisten',
      cultistsWhoGotAway: 'Entkommene Kultisten',
    },
  },
} as const satisfies CampaignTexts;
