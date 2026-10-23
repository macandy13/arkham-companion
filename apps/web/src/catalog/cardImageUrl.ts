import type { CardImagePath } from '@arkham/engine';

/**
 * Where card pictures come from. ArkhamDB serves them for every language from the English host,
 * and the app fetches them on the player's device, since card art may not be bundled
 * (architecture "Web app"). The service worker caches what comes from here (`cardImageCaching`).
 */
export const CARD_IMAGE_HOST = 'https://arkhamdb.com';

/** The address of a card picture, from its host-relative path (`CardStats.imageSrc`). */
export const cardImageUrl = (path: CardImagePath) => `${CARD_IMAGE_HOST}${path}`;
