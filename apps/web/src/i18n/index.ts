import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

/** UI strings (not card text) per language; `en` is the fallback. */
export const resources = {
  en: {
    translation: {
      app: { title: 'Arkham Companion' },
      header: { round: 'Round', phase: 'Phase', undo: 'Undo', noGame: 'No game open' },
      map: { placeholder: 'Map' },
      investigators: { placeholder: 'Investigators' },
      encounter: { placeholder: 'Encounter' },
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
      map: { placeholder: 'Karte' },
      investigators: { placeholder: 'Ermittler' },
      encounter: { placeholder: 'Begegnung' },
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
