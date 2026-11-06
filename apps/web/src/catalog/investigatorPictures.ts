import type { CardCatalog } from '@arkham/carddata';
import { cardImagePath, type CardImagePath } from '@arkham/engine';

/**
 * Where each investigator's card picture is, by investigator code, for the catalog's investigators
 * that have one (home's team portraits, `TeamPortraits`).
 */
export function investigatorPictures(catalog: CardCatalog): ReadonlyMap<string, CardImagePath> {
  return new Map(
    catalog.investigators.flatMap(({ code, imageSrc }) =>
      imageSrc ? [[code, cardImagePath(imageSrc)] as const] : [],
    ),
  );
}
