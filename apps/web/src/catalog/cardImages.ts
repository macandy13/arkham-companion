import { useState, type SyntheticEvent } from 'react';
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
  onLoad: (event: SyntheticEvent<Element>) => void;
  onError: () => void;
}

/** Which way round a card's scan is printed: an agenda or act lies, every other card stands. */
export type PictureShape = 'landscape' | 'portrait';

/** The shape of a loaded `img`, or nothing while its size is unknown (a test's fake load has none). */
function loadedShape(image: HTMLImageElement): PictureShape | undefined {
  const { naturalWidth: width, naturalHeight: height } = image;
  if (width === 0 || height === 0) return undefined;
  return width > height ? 'landscape' : 'portrait';
}

/**
 * The picture of a card face for `path` (a view's `image`), or nothing when the card data has
 * none. The loaded state is kept per address, so a face that turns to another side (a location
 * revealed, the next agenda) waits for that side's picture again. Given the card's `shape`, a
 * picture that loads the other way round never shows: about one ArkhamDB scan in fifty is turned
 * on its side, and its art cut would show the wrong part, so the face keeps its pattern instead.
 */
export function useCardPicture(
  path: CardImagePath | undefined,
  shape?: PictureShape,
): CardPicture | undefined {
  const [loadedUrl, setLoadedUrl] = useState<string>();
  const [sidewaysUrl, setSidewaysUrl] = useState<string>();
  if (path === undefined) return undefined;
  const url = cardImageUrl(path);
  return {
    url,
    shown: loadedUrl === url && sidewaysUrl !== url,
    onLoad: (event) => {
      if (!shape) {
        setLoadedUrl(url);
        return;
      }
      const settle = (loaded: PictureShape | undefined) => {
        if (loaded && loaded !== shape) setSidewaysUrl(url);
        else setLoadedUrl(url);
      };
      const target = event.currentTarget;
      if (target instanceof HTMLImageElement) {
        settle(loadedShape(target));
        return;
      }
      // An SVG `image` has no size to read, so a probe loads the same picture, cached by now, to
      // tell its shape. A probe that fails tells nothing, and the picture shows as loaded.
      const probe = new Image();
      probe.onload = () => settle(loadedShape(probe));
      probe.onerror = () => settle(undefined);
      probe.src = url;
    },
    onError: () => setLoadedUrl(undefined),
  };
}
