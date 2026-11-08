import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardImagePath } from '@arkham/engine';
import { savePictures, type PictureProgress } from './savePictures';

describe('savePictures', () => {
  afterEach(() => vi.restoreAllMocks());

  it('fetches each picture from ArkhamDB without CORS, like the img that shows it', async () => {
    const requests: [string, RequestInit][] = [];

    await savePictures(
      [cardImagePath('/bundles/cards/01111.png'), cardImagePath('/bundles/cards/01112.png')],
      () => {},
      async (url, init) => requests.push([url, init]),
    );

    expect(requests).toEqual([
      ['https://arkhamdb.com/bundles/cards/01111.png', { mode: 'no-cors' }],
      ['https://arkhamdb.com/bundles/cards/01112.png', { mode: 'no-cors' }],
    ]);
  });

  it('counts a picture that fails and goes on with the rest', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const heard: PictureProgress[] = [];

    const result = await savePictures(
      [cardImagePath('/bundles/cards/missing.png'), cardImagePath('/bundles/cards/01112.png')],
      (progress) => heard.push(progress),
      async (url) => {
        if (url.endsWith('missing.png')) throw new TypeError('Failed to fetch');
      },
    );

    expect(result).toEqual({ saved: 1, failed: 1, total: 2 });
    expect(heard.at(-1)).toEqual({ saved: 1, failed: 1, total: 2 });
  });
});
