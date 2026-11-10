import { basename, join } from 'node:path';
import { cardImagePath } from '@arkham/engine';
import type { CardType } from '@arkham/engine';
import {
  theDevourerBelowCardDefs,
  theGatheringCardDefs,
  theMidnightMasksCardDefs,
} from '@arkham/scenarios';
import { campaignKeyArts } from '../../src/catalog/campaignKeyArt';

/**
 * Our own mock artworks (`mock_art/`), which E2E serves in place of the card pictures from
 * ArkhamDB and the key art from FFG. Real card art can't be committed and had to be downloaded
 * before every run, and ArkhamDB stops answering a CI runner after a few dozen pictures, so
 * screenshots differed with whatever a runner got. Each artwork is drawn at its scan's size and
 * shape (portrait 300 × 419, an agenda, act or investigator front landscape), with its subject
 * where the app cuts the art out (`src/catalog/cardArt.ts`), so the card frames, art crops and
 * token avatars show as they would with the real scans.
 */
const MOCK_ART_DIR = join(import.meta.dirname, 'mock_art');

/** Roland Banks' picture, so the investigator card's art window shows a crop in the shots. */
export const ROLAND_PICTURE = cardImagePath('/bundles/cards/01001.png');

/** The Gathering's reference card front, as `cards.json` names it for the card pictures theme. */
const GATHERING_REFERENCE_PICTURE = cardImagePath('/bundles/cards/01104.png');

/** The artworks of each kind of picture; a card's code picks one, so neighbours differ. */
const VARIANTS = {
  location: ['location_house', 'location_street', 'location_woods'],
  enemy: ['enemy_ghoul', 'enemy_cultist', 'enemy_beast'],
  treachery: ['treachery_eye', 'treachery_omen'],
  investigator: ['investigator_hat', 'investigator_scarf'],
  agenda: ['agenda'],
  act: ['act'],
  asset: ['asset'],
  reference: ['reference'],
  keyArt: ['key_art'],
} as const satisfies Record<string, readonly string[]>;

type ArtKind = keyof typeof VARIANTS;

/** The kind of artwork for each card type the test scenarios' cards have. */
const KIND_OF_TYPE: Readonly<Partial<Record<CardType, ArtKind>>> = {
  location: 'location',
  enemy: 'enemy',
  treachery: 'treachery',
  investigator: 'investigator',
  agenda: 'agenda',
  act: 'act',
  asset: 'asset',
};

/**
 * The kind of artwork of every picture the E2E games name: both sides of the Night of the
 * Zealot scenarios' cards, The Gathering's reference card, Roland Banks and each campaign's key
 * art. Other pictures stay unanswered, as when the player is offline, and their faces keep the
 * pattern.
 */
const KINDS: ReadonlyMap<string, ArtKind> = new Map([
  ...[...theGatheringCardDefs, ...theMidnightMasksCardDefs, ...theDevourerBelowCardDefs].flatMap(
    ({ typeCode, imageSrc, backImageSrc }) => {
      const kind = KIND_OF_TYPE[typeCode];
      if (!kind) return [];
      return [imageSrc, backImageSrc].flatMap((path) => (path ? [[path, kind] as const] : []));
    },
  ),
  [GATHERING_REFERENCE_PICTURE, 'reference'],
  [ROLAND_PICTURE, 'investigator'],
  ...campaignKeyArts.map((address) => [address, 'keyArt'] as const),
]);

/** A stable pick from `count` artworks for `name`, so a card shows the same art every run. */
function pick(name: string, count: number): number {
  return [...name].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % count;
}

/**
 * The mock artwork file to answer the picture at `address` (an ArkhamDB path or a key art
 * address) with, or nothing for a picture no E2E game names.
 */
export function mockCardArt(address: string): string | undefined {
  const kind = KINDS.get(address);
  if (!kind) return undefined;
  const variants = VARIANTS[kind];
  const name = variants[pick(basename(address), variants.length)];
  return join(MOCK_ART_DIR, `${name}.svg`);
}
