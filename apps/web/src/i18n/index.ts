import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { appTexts as appDe } from './de/app';
import { nightOfTheZealotTexts as nightOfTheZealotDe } from './de/night_of_the_zealot';
import { appTexts as appEn } from './en/app';
import { nightOfTheZealotTexts as nightOfTheZealotEn } from './en/night_of_the_zealot';

/**
 * The sections a campaign's strings add to. Each campaign keeps its words in a file of its own per
 * language, so the app's file doesn't grow with every campaign; they meet in these sections.
 */
export const CAMPAIGN_SECTIONS = ['campaigns', 'scenarios', 'scenario', 'story'] as const;

/** One campaign's strings in one language, e.g. `en/night_of_the_zealot.ts`. */
export type CampaignTexts = { readonly [S in (typeof CAMPAIGN_SECTIONS)[number]]: object };

/** One language's strings: the app's own plus every campaign's, section by section. */
function translation<A extends object>(app: A, campaigns: readonly CampaignTexts[]) {
  const sections = CAMPAIGN_SECTIONS.map((section) => [
    section,
    Object.assign({}, ...campaigns.map((campaign) => campaign[section])),
  ]);
  return { ...app, ...Object.fromEntries(sections) };
}

/** Each language's campaign strings, in the order of the campaign catalog. */
export const campaignTexts = {
  en: [nightOfTheZealotEn],
  de: [nightOfTheZealotDe],
} as const;

/** UI strings (not card text) per language; `en` is the fallback. */
export const resources = {
  en: { translation: translation(appEn, campaignTexts.en) },
  de: { translation: translation(appDe, campaignTexts.de) },
};

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
