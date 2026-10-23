import type { VitePWAOptions } from 'vite-plugin-pwa';
import { CARD_IMAGE_HOST } from '../catalog/cardImages';

/** One of Workbox's runtime caching rules, as `vite.config.ts` passes them to the plugin. */
type RuntimeCaching = NonNullable<VitePWAOptions['workbox']['runtimeCaching']>[number];

/**
 * The service worker's rule for card pictures (Workbox `runtimeCaching`, configured in
 * `vite.config.ts`): every picture under ArkhamDB's card path is kept once fetched and served
 * from the cache from then on, so a started game keeps its art offline. Card pictures never
 * change, hence cache first. The pictures load as plain `img`s without CORS, so the cache holds
 * opaque responses (status 0); browsers count those at a padded size against the quota, so the
 * cache is capped and dropped first when the quota runs out.
 */
export const cardImageCaching: RuntimeCaching = {
  urlPattern: new RegExp(`^${CARD_IMAGE_HOST.replace(/[.]/g, '\\.')}/bundles/cards/`),
  handler: 'CacheFirst',
  options: {
    cacheName: 'card-images',
    cacheableResponse: { statuses: [0, 200] },
    expiration: { maxEntries: 500, purgeOnQuotaError: true },
  },
};
