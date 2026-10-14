import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

/** UI strings (not card text) per language; `en` is the fallback. */
export const resources = {
  en: {
    translation: {
      app: { title: 'Arkham Companion' },
      header: { round: 'Round', phase: 'Phase', undo: 'Undo', noGame: 'No game open' },
      nav: { label: 'Main' },
      map: { title: 'Map' },
      investigators: { title: 'Investigators' },
      encounter: { title: 'Encounter' },
      settings: { title: 'Settings', placeholder: 'Settings will appear here.' },
      wizard: {
        title: 'New game',
        placeholder: 'The game setup wizard will appear here.',
        createEmpty: 'Create empty game',
      },
      games: {
        title: 'Games',
        new: 'New game',
        empty: 'No games yet',
        untitled: 'Game {{n}}',
        open: 'Open',
      },
    },
  },
  de: {
    translation: {
      app: { title: 'Arkham Companion' },
      header: { round: 'Runde', phase: 'Phase', undo: 'Rückgängig', noGame: 'Kein Spiel geöffnet' },
      nav: { label: 'Hauptnavigation' },
      map: { title: 'Karte' },
      investigators: { title: 'Ermittler' },
      encounter: { title: 'Begegnung' },
      settings: { title: 'Einstellungen', placeholder: 'Hier erscheinen die Einstellungen.' },
      wizard: {
        title: 'Neues Spiel',
        placeholder: 'Hier erscheint der Assistent zum Einrichten eines Spiels.',
        createEmpty: 'Leeres Spiel erstellen',
      },
      games: {
        title: 'Spiele',
        new: 'Neues Spiel',
        empty: 'Noch keine Spiele',
        untitled: 'Spiel {{n}}',
        open: 'Öffnen',
      },
    },
  },
} as const;

/** Initialises the shared i18next instance; the language follows the browser, falling back to `en`. */
export async function initI18n(lng?: string): Promise<typeof i18next> {
  await i18next.use(initReactI18next).init({
    resources,
    lng: lng ?? (typeof navigator === 'undefined' ? 'en' : navigator.language.slice(0, 2)),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
  return i18next;
}

export { i18next };
