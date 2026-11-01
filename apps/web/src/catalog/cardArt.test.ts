import { describe, expect, it } from 'vitest';
import { ART_WINDOW, TILE } from '../map/mapLayout';
import {
  ENEMY_AVATAR,
  INVESTIGATOR_AVATAR,
  LANDSCAPE_SCAN,
  LOCATION_ART,
  PORTRAIT_SCAN,
  artViewBox,
} from './cardArt';
import { TILE_PER_SCAN } from './cardFace';

describe('artViewBox', () => {
  it.each([
    { area: { x: 0, y: 0, width: 1, height: 1 }, viewBox: '0 0 300 419' },
    { area: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 }, viewBox: '150 210 150 210' },
    { area: { x: 0, y: 0.1, width: 1, height: 0.4 }, viewBox: '0 42 300 168' },
  ])('shows $viewBox of a portrait scan', ({ area, viewBox }) => {
    expect(artViewBox(area)).toBe(viewBox);
  });
});

describe('LOCATION_ART', () => {
  it("is the area of the scan that the tile's art window covers of the tile, a tile being half a scan", () => {
    const { x, y, width, height } = ART_WINDOW;
    const scaledToScan = [x, y, width, height].map((value) => 2 * value).join(' ');

    expect(artViewBox(LOCATION_ART)).toBe(scaledToScan);
  });
});

describe('TILE_PER_SCAN', () => {
  it('draws a card face measured on a scan at the size of a map tile', () => {
    expect(PORTRAIT_SCAN.width * TILE_PER_SCAN).toBe(TILE.width);
    expect(Math.round(PORTRAIT_SCAN.height * TILE_PER_SCAN)).toBe(TILE.height);
  });
});

describe('avatars', () => {
  it.each([
    {
      avatar: 'investigator',
      area: INVESTIGATOR_AVATAR,
      scan: LANDSCAPE_SCAN,
      viewBox: '45 56 110 110',
    },
    { avatar: 'enemy', area: ENEMY_AVATAR, scan: PORTRAIT_SCAN, viewBox: '75 256 150 150' },
  ])('cuts the $avatar avatar as a square of its scan: $viewBox', ({ area, scan, viewBox }) => {
    expect(artViewBox(area, scan)).toBe(viewBox);
  });
});
