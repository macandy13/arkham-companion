import type { CampaignTexts } from '../index';

/** Brethren of Ash's German strings (the Core Set (2026) campaign): its scenarios and their choices so far. */
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
  },
  scenarios: { spreadingFlames: 'Spreading Flames' },
  campaigns: {},
  story: {},
} satisfies CampaignTexts;
