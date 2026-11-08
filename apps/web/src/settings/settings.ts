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

/**
 * The table the app lies on (MD.7, product.md "Design language"): a playmat with its own table
 * colours. `nightAndBrass` is the sea-green table with brass, `stars` a dark star chart with a
 * nebula, `rlyeh` a drowned city, `parchment` the one light table, for a bright room. Paper, cards
 * and the game's colours stay the same on every table.
 */
export const TABLE_SKINS = ['nightAndBrass', 'stars', 'rlyeh', 'parchment'] as const;
export type TableSkin = (typeof TABLE_SKINS)[number];

/** Whether `skin` is a light table, which the stylesheets' light colours (`data-theme`) go with. */
export function isLightSkin(skin: TableSkin): boolean {
  return skin === 'parchment';
}

/**
 * How the game's tokens look (MD.8, `GameToken`): `resin` the fans' resin domes, glossy with a
 * bronze rim; `cardboard` the box's matte die-cut tokens, its resources hexagons.
 */
export const TOKEN_SETS = ['resin', 'cardboard'] as const;
export type TokenSet = (typeof TOKEN_SETS)[number];

/**
 * How card faces look (product.md, "Card themes"): `exact` draws the printed card's frame
 * ourselves and cuts the card's ArkhamDB picture out into its art area (`cardArt.ts`), `pictures`
 * shows the whole scanned card. Without a picture both show our frame with a pattern for the art.
 * `nightAndBrass` draws the same frames as `exact` in other colours (`tokens.css`): sea-green card
 * stock, brass ornament, bone text. `eldritch` draws them cut from the void, its scrolls
 * turned into tentacles with a glowing outline (`OrnamentLine`).
 */
export const CARD_THEMES = ['exact', 'nightAndBrass', 'eldritch', 'pictures'] as const;
export type CardTheme = (typeof CARD_THEMES)[number];

/**
 * What an enemy's token on the map shows: the figure from its card's picture (`art`, the initial
 * while the picture loads or when it fails) or always its `initials`, plainer and quicker to tell
 * apart at a glance.
 */
export const ENEMY_TOKEN_FACES = ['art', 'initials'] as const;
export type EnemyTokenFace = (typeof ENEMY_TOKEN_FACES)[number];

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
  readonly tableSkin: TableSkin;
  readonly tokenSet: TokenSet;
  readonly cardTheme: CardTheme;
  readonly enemyTokens: EnemyTokenFace;
}

/** Defaults for a fresh device; a dark table because the app is used at a dim one. */
export const DEFAULT_SETTINGS: Settings = {
  ownedPacks: [],
  cardLanguage: 'en',
  tableSkin: 'nightAndBrass',
  tokenSet: 'resin',
  cardTheme: 'exact',
  enemyTokens: 'art',
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
    // The light table used to be its own setting, by night or by day, saved beside a skin; it
    // goes on the next save, which no longer writes it.
    tableSkin:
      (raw.theme === 'light' ? 'parchment' : undefined) ??
      oneOf(TABLE_SKINS, raw.tableSkin) ??
      DEFAULT_SETTINGS.tableSkin,
    tokenSet: oneOf(TOKEN_SETS, raw.tokenSet) ?? DEFAULT_SETTINGS.tokenSet,
    cardTheme:
      oneOf(CARD_THEMES, raw.cardTheme) ??
      (typeof raw.cardLook === 'string' ? CARD_LOOK_THEMES[raw.cardLook] : undefined) ??
      DEFAULT_SETTINGS.cardTheme,
    enemyTokens: oneOf(ENEMY_TOKEN_FACES, raw.enemyTokens) ?? DEFAULT_SETTINGS.enemyTokens,
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
