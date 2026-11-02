import { i18next } from '../i18n';
import type { Settings } from './settings';

/**
 * Pushes the settings that act on the document: the theme (via `data-theme`, which
 * `tokens.css` switches on), the card theme (via `data-card-theme`, which the card
 * faces' stylesheets switch on), the enemy tokens' face (via `data-enemy-tokens`, which
 * `map.css` switches on) and the UI language. Kept apart from `settings.ts` so that
 * module stays free of DOM and i18next.
 */
export function applySettings(settings: Settings): void {
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.dataset.cardTheme = settings.cardTheme;
  document.documentElement.dataset.enemyTokens = settings.enemyTokens;
  if (settings.uiLanguage && settings.uiLanguage !== i18next.language) {
    void i18next.changeLanguage(settings.uiLanguage);
  }
}
