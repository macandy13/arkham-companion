import { i18next } from '../i18n';
import type { Settings } from './settings';

/**
 * Pushes the settings that act on the document: the theme (via `data-theme`, which
 * `tokens.css` switches on) and the UI language. Kept apart from `settings.ts` so that
 * module stays free of DOM and i18next.
 */
export function applySettings(settings: Settings): void {
  document.documentElement.dataset.theme = settings.theme;
  if (settings.uiLanguage && settings.uiLanguage !== i18next.language) {
    void i18next.changeLanguage(settings.uiLanguage);
  }
}
