import { describe, expect, it } from 'vitest';
import { pictureVariants } from './pictures.ts';

const desktopShot = 'apps/web/e2e/__screenshots__/screenshot/shots/board.spec.ts/board.png';
const phoneShot = 'apps/web/e2e/__screenshots__/screenshot-phone/shots/board.spec.ts/board.png';
const flowPicture = 'apps/web/e2e/__screenshots__/flow-picture/play.spec.ts/draw-a-weakness.png';

describe('pictureVariants', () => {
  it.each([
    {
      case: 'a shot on desktop and phone',
      picture: 'shots/board.spec.ts/board.png',
      base: [desktopShot, phoneShot],
      head: [desktopShot, phoneShot],
      variants: [
        { device: 'desktop', before: desktopShot, after: desktopShot },
        { device: 'phone', before: phoneShot, after: phoneShot },
      ],
    },
    {
      case: 'a flow picture the PR adds',
      picture: 'play.spec.ts/draw-a-weakness.png',
      base: [],
      head: [flowPicture],
      variants: [{ device: 'tablet', after: flowPicture }],
    },
    {
      case: 'a phone shot the PR removes',
      picture: 'shots/board.spec.ts/board.png',
      base: [phoneShot],
      head: [],
      variants: [{ device: 'phone', before: phoneShot }],
    },
  ])('finds $case', ({ picture, base, head, variants }) => {
    expect(pictureVariants(picture, new Set(base), new Set(head))).toEqual(variants);
  });

  it('fails for a name no device has', () => {
    expect(() =>
      pictureVariants(
        'shots/board.spec.ts/bord.png',
        new Set([desktopShot]),
        new Set([desktopShot]),
      ),
    ).toThrow('No golden named shots/board.spec.ts/bord.png');
  });
});
