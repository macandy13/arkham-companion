/**
 * Languages ArkhamDB serves card data in, the one list the app's settings, its catalog loader and
 * `pnpm carddata:fetch` read. Each language but English has its own subdomain
 * (`de.arkhamdb.com`); ArkhamDB itself fills in English for a card it has no translation of.
 */
export const CARD_LANGUAGES = [
  'en',
  'de',
  'es',
  'fr',
  'it',
  'ko',
  'pl',
  'pt',
  'ru',
  'uk',
  'zh',
] as const;
export type CardLanguage = (typeof CARD_LANGUAGES)[number];

/** Whether `value` names one of `CARD_LANGUAGES`. */
export function isCardLanguage(value: string): value is CardLanguage {
  return (CARD_LANGUAGES as readonly string[]).includes(value);
}

/** The ArkhamDB site that serves card data in `lang`, without a trailing slash. */
export function arkhamDbHost(lang: CardLanguage): string {
  return lang === 'en' ? 'https://arkhamdb.com' : `https://${lang}.arkhamdb.com`;
}
