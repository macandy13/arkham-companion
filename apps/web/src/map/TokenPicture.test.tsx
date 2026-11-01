// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { cardImagePath } from '@arkham/engine';
import { ENEMY_AVATAR, PORTRAIT_SCAN } from '../catalog/cardArt';
import { TokenPicture } from './TokenPicture';

// The avatar is decoration without a role, so it is found by `data-part`.
describe('TokenPicture', () => {
  afterEach(cleanup);

  it("cuts the enemy's figure from its picture onto the token, shown once loaded", () => {
    const { container } = render(
      <svg>
        <TokenPicture
          image={cardImagePath('/bundles/cards/ghoul_priest.png')}
          area={ENEMY_AVATAR}
          scan={PORTRAIT_SCAN}
          centre={{ x: 50, y: 50 }}
          radius={14}
        />
      </svg>,
    );
    const avatar = container.querySelector('[data-part="avatar"]');
    const image = avatar?.querySelector('image');
    if (!avatar || !image) throw new Error('the token has no avatar');

    expect(image.getAttribute('href')).toBe('https://arkhamdb.com/bundles/cards/ghoul_priest.png');
    expect(avatar.querySelector('svg')?.getAttribute('viewBox')).toBe('75 256 150 150');
    expect(avatar.hasAttribute('data-picture')).toBe(false);
    // jsdom loads no images, so the test fires the load itself.
    fireEvent.load(image);
    expect(avatar.getAttribute('data-picture')).toBe('shown');
  });

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
