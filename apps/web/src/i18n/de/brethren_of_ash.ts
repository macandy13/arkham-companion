import type { CampaignTexts } from '../index';

/** Brethren of Ash's German strings (the Core Set (2026) campaign): its name, scenarios, scenario choices and story records. */
export const brethrenOfAshTexts = {
  scenario: {
    spreadingFlames: {
      cosmicEvils: {
        prompt: '{{card}}: Du musst entweder',
        doom: '1 Verderben auf die aktuelle Agenda legen',
        wounds: '1 direkten Schaden und 1 direkten Horror erleiden; die Karte erhält Nachrücken',
      },
      stayOrGo: {
        prompt: 'Auflösung 1: Lest sie vor, dann muss der Ermittlungsleiter entscheiden',
        stay: 'Bleibt und bekämpft das Feuer!',
        go: '„Es bleibt keine Zeit. Wir müssen gehen.“',
      },
      resolution: {
        earnArmitage:
          'Wer Dr. Henry Armitage erhalten hat, nimmt ihn ohne Rücksicht auf die Deckbauregeln in sein Deck auf; er zählt nicht zur Deckgröße.',
        upgradeDecks: 'Jeder Ermittler gibt Erfahrung für Deckverbesserungen aus.',
      },
    },
    smokeAndMirrors: {
      resolution: {
        drawForTheHarbinger:
          'Sammelt jeden Elite-Gegner, der bei Szenarioende im Spiel und/oder unter einem Ort war, mischt sie verdeckt mit dem Vorboten von Elokoss und zieht einen zufällig: Ist es der Vorbote, haben die Ermittler den Aufenthaltsort des Kults entdeckt.',
        upgradeDecks: 'Jeder Ermittler gibt Erfahrung für Deckverbesserungen aus.',
      },
    },
    queenOfAsh: {
      resolution: {
        collector:
          'Nehmt beide Exemplare von Collector in euren Spielerkartenvorrat auf; jeder Ermittler darf eines in sein Deck nehmen.',
      },
    },
  },
  scenarios: {
    spreadingFlames: 'Spreading Flames',
    smokeAndMirrors: 'Smoke and Mirrors',
    queenOfAsh: 'Queen of Ash',
  },
  campaigns: { brethrenOfAsh: 'Brethren of Ash' },
  // The campaign notes in our own words, not the campaign guide's.
  story: {
    brethrenOfAsh: {
      savedMiskatonicUniversity: {
        yes: 'Ihr habt die Miskatonic University vor dem Feuer gerettet.',
        no: 'Die Miskatonic University ist niedergebrannt.',
      },
      defeatedTheirMaskedPursuer: {
        yes: 'Ihr habt die maskierte Gestalt besiegt, die euch jagte.',
      },
      discoveredTheCultsWhereabouts: {
        yes: 'Ihr habt herausgefunden, wo sich der Kult versteckt.',
        no: 'Eure Suche nach dem Kult blieb erfolglos.',
      },
      killedTheServantOfFlame: { yes: 'Ihr habt den Diener der Flamme getötet.' },
      theServantOfFlameEscaped: { yes: 'Der Diener der Flamme ist entkommen.' },
      scouredArkhamForAnswers: { yes: 'Ihr habt ganz Arkham nach Antworten abgesucht.' },
      stirredUpTrouble: { yes: 'Ihr habt in ganz Arkham für Unruhe gesorgt.' },
      elokossWasReborn: { yes: 'Elokoss wurde in Flammen wiedergeboren.' },
      defeatedElokossAndTheBrethren: { yes: 'Ihr habt Elokoss und die Brethren of Ash besiegt.' },
      stoppedElokosssRebirth: { yes: 'Ihr habt die Wiedergeburt von Elokoss verhindert.' },
      floodedTheSummoningRitual: { yes: 'Ihr habt das Beschwörungsritual des Kults überflutet.' },
      harbingerOfElokoss: 'Vorbote von Elokoss',
    },
  },
} satisfies CampaignTexts;
