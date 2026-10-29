/** UI languages that have translation strings (`i18n/index.ts`). */
export const UI_LANGUAGES = ['en', 'de'] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

/** Languages ArkhamDB serves card text in; each one has its own subdomain (`de.arkhamdb.com`). */
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

export const THEMES = ['dark', 'light'] as const;
export type Theme = (typeof THEMES)[number];

/**
 * How card faces look (product.md, "Card themes"): `exact` draws the printed card's frame
 * ourselves and cuts the card's ArkhamDB picture out into its art area (`cardArt.ts`), `pictures`
 * shows the whole scanned card. Without a picture both show our frame with a pattern for the art.
 * The drawn themes Night and brass and Eldritch join this list once they are built.
 */
export const CARD_THEMES = ['exact', 'pictures'] as const;
export type CardTheme = (typeof CARD_THEMES)[number];

/** What the card theme replaced: the old "Card pictures" setting, read once into the new one. */
const CARD_LOOK_THEMES: Readonly<Record<string, CardTheme>> = {
  frames: 'exact',
  faces: 'pictures',
};

/** Per-device preferences; they live in localStorage, not with the games (architecture "Persistence"). */
export interface Settings {
  /** Pack codes the player owns; drives the picker's "my collection" filter. */
  readonly ownedPacks: readonly string[];
  readonly cardLanguage: CardLanguage;
  /** Unset means "follow the browser language" until the player picks one. */
  readonly uiLanguage?: UiLanguage;
  readonly theme: Theme;
  readonly cardTheme: CardTheme;
}

/** Defaults for a fresh device; dark because the app is used at a dim table. */
export const DEFAULT_SETTINGS: Settings = {
  ownedPacks: [],
  cardLanguage: 'en',
  theme: 'dark',
  cardTheme: 'exact',
};

const STORAGE_KEY = 'arkham-companion.settings';

function oneOf<T extends string>(options: readonly T[], value: unknown): T | undefined {
  return options.find((option) => option === value);
}

function parseSettings(value: unknown): Settings {
  if (typeof value !== 'object' || value === null) return DEFAULT_SETTINGS;
  const raw = value as Record<string, unknown>;
  const uiLanguage = oneOf(UI_LANGUAGES, raw.uiLanguage);
  return {
    ownedPacks:
      Array.isArray(raw.ownedPacks) && raw.ownedPacks.every((code) => typeof code === 'string')
        ? raw.ownedPacks
        : DEFAULT_SETTINGS.ownedPacks,
    cardLanguage: oneOf(CARD_LANGUAGES, raw.cardLanguage) ?? DEFAULT_SETTINGS.cardLanguage,
    ...(uiLanguage && { uiLanguage }),
    theme: oneOf(THEMES, raw.theme) ?? DEFAULT_SETTINGS.theme,
    cardTheme:
      oneOf(CARD_THEMES, raw.cardTheme) ??
      (typeof raw.cardLook === 'string' ? CARD_LOOK_THEMES[raw.cardLook] : undefined) ??
      DEFAULT_SETTINGS.cardTheme,
  };
}

/**
 * Reads the settings, field by field falling back to defaults. Storage can be missing or
 * throw (private mode, blocked cookies) and hold corrupt data after manual edits or old
 * versions, none of which may stop the app from starting.
 */
export function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? DEFAULT_SETTINGS : parseSettings(JSON.parse(stored));
  } catch (error) {
    console.warn('Could not load settings; using the defaults.', error);
    return DEFAULT_SETTINGS;
  }
}

/** Persists the settings; failures are logged but not thrown because losing a preference beats crashing. */
export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    // Quota exceeded or storage unavailable: the in-memory settings still apply this session.
    console.warn('Could not save settings; they apply for this session only.', error);
  }
}
