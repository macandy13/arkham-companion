import { describe, expect, it } from 'vitest';
import { ART_WINDOW } from '../map/mapLayout';
import { LOCATION_ART, portraitArtViewBox } from './cardArt';

describe('portraitArtViewBox', () => {
  it.each([
    { area: { x: 0, y: 0, width: 1, height: 1 }, viewBox: '0 0 300 419' },
    { area: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 }, viewBox: '150 210 150 210' },
    { area: { x: 0, y: 0.1, width: 1, height: 0.4 }, viewBox: '0 42 300 168' },
  ])('shows $viewBox of a portrait scan', ({ area, viewBox }) => {
    expect(portraitArtViewBox(area)).toBe(viewBox);
  });
});

describe('LOCATION_ART', () => {
  it("is the area of the scan that the tile's art window covers of the tile, a tile being half a scan", () => {
    const { x, y, width, height } = ART_WINDOW;
    const scaledToScan = [x, y, width, height].map((value) => 2 * value).join(' ');

    expect(portraitArtViewBox(LOCATION_ART)).toBe(scaledToScan);
  });
});
