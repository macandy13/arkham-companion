// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardImagePath } from '@arkham/engine';
import {
  ENEMY_AVATAR,
  INVESTIGATOR_AVATAR,
  LANDSCAPE_SCAN,
  PORTRAIT_SCAN,
} from '../catalog/cardArt';
import { TokenPicture } from './TokenPicture';

/**
 * Stands in for the `Image` the picture hook probes an SVG picture's shape with, since jsdom loads
 * no images: each probe loads at once at the size given.
 */
function scansLoadAt(width: number, height: number) {
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = width;
      naturalHeight = height;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_url: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  );
}

// The avatar is decoration without a role, so it is found by `data-part`.
describe('TokenPicture', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each([
    {
      token: "an enemy's figure",
      area: ENEMY_AVATAR,
      scan: PORTRAIT_SCAN,
      loadsAt: { width: 300, height: 419 },
      viewBox: '75 256 150 150',
      shown: true,
    },
    {
      token: "an investigator's face",
      area: INVESTIGATOR_AVATAR,
      scan: LANDSCAPE_SCAN,
      loadsAt: { width: 419, height: 300 },
      viewBox: '45 56 110 110',
      shown: true,
    },
    {
      token: "an investigator's face from a scan turned upright",
      area: INVESTIGATOR_AVATAR,
      scan: LANDSCAPE_SCAN,
      loadsAt: { width: 300, height: 419 },
      viewBox: '45 56 110 110',
      shown: false,
    },
  ])(
    'cuts $token from its picture, viewBox $viewBox',
    async ({ area, scan, loadsAt, viewBox, shown }) => {
      scansLoadAt(loadsAt.width, loadsAt.height);
      const { container } = render(
        <svg>
          <TokenPicture
            image={cardImagePath('/bundles/cards/token.png')}
            area={area}
            scan={scan}
            centre={{ x: 50, y: 50 }}
            radius={14}
          />
        </svg>,
      );
      const avatar = container.querySelector('[data-part="avatar"]');
      const image = avatar?.querySelector('image');
      if (!avatar || !image) throw new Error('the token has no avatar');

      expect(image.getAttribute('href')).toBe('https://arkhamdb.com/bundles/cards/token.png');
      expect(avatar.querySelector('svg')?.getAttribute('viewBox')).toBe(viewBox);
      expect(avatar.hasAttribute('data-picture')).toBe(false);
      await act(async () => {
        fireEvent.load(image);
        await Promise.resolve();
      });
      expect(avatar.hasAttribute('data-picture')).toBe(shown);
    },
  );

  it('draws nothing for a card without a picture, so the token keeps its initial', () => {
    const { container } = render(
      <svg>
        <TokenPicture
          image={undefined}
          area={ENEMY_AVATAR}
          scan={PORTRAIT_SCAN}
          centre={{ x: 50, y: 50 }}
          radius={14}
        />
      </svg>,
    );

    expect(container.querySelector('[data-part="avatar"]')).toBeNull();
  });
});
