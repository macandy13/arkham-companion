import { useState } from 'react';
import type { CardImagePath } from '@arkham/engine';
import { cardImageUrl } from './cardImageUrl';

/**
 * A card face's picture while it loads: its address, whether it has loaded (`shown`) and the
 * handlers for the `img` or SVG `image` that loads it. A card face keeps its own pattern, name and
 * badges until the picture has loaded, and keeps them for good when it fails (offline before it
 * was cached, or the host is down), so a face never shows a broken image.
 */
export interface CardPicture {
  url: string;
  shown: boolean;
  onLoad: () => void;
  onError: () => void;
}

/**
 * The picture of a card face for `path` (a view's `image`), or nothing when the card data has
 * none. The loaded state is kept per address, so a face that turns to another side (a location
 * revealed, the next agenda) waits for that side's picture again.
 */
export function useCardPicture(path: CardImagePath | undefined): CardPicture | undefined {
  const [loadedUrl, setLoadedUrl] = useState<string>();
  if (path === undefined) return undefined;
  const url = cardImageUrl(path);
  return {
    url,
    shown: loadedUrl === url,
    onLoad: () => setLoadedUrl(url),
    onError: () => setLoadedUrl(undefined),
  };
}
