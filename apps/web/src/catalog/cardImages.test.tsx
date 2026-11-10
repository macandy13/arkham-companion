// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cardImagePath, type CardImagePath } from '@arkham/engine';
import { useCardPicture, type PictureShape } from './cardImages';

/** A stand-in for the browser's `Image`, so a test decides when and at what size a probe loads. */
class FakeImage {
  static made: FakeImage[] = [];
  src = '';
  naturalWidth = 0;
  naturalHeight = 0;
  onload: (() => void) | null = null;
  constructor() {
    FakeImage.made.push(this);
  }
  /** Loads the probe at a portrait (300 × 419) or landscape (419 × 300) scan size. */
  load(size: PictureShape) {
    [this.naturalWidth, this.naturalHeight] = size === 'portrait' ? [300, 419] : [419, 300];
    act(() => this.onload?.());
  }
}

const probeOf = (address: string) => {
  const probe = FakeImage.made.find((image) => image.src.endsWith(address));
  if (!probe) throw new Error(`no probe of ${address}`);
  return probe;
};

describe('useCardPicture', () => {
  const study_back = cardImagePath('/bundles/cards/study_back.png');
  const study = cardImagePath('/bundles/cards/study.png');

  beforeEach(() => {
    FakeImage.made = [];
    vi.stubGlobal('Image', FakeImage);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the picture once its own probe has loaded, with no load event from the face', () => {
    const { result } = renderHook(() => useCardPicture(study, 'portrait'));

    probeOf('study.png').load('portrait');

    expect(result.current?.shown).toBe(true);
  });

  it('keeps the pattern of a picture that loads the other way round from the card', () => {
    const { result } = renderHook(() => useCardPicture(study, 'portrait'));

    probeOf('study.png').load('landscape');

    expect(result.current?.shown).toBe(false);
  });

  it('ignores the late probe of the side a face turned away from', () => {
    const { result, rerender } = renderHook(
      ({ side }: { side: CardImagePath }) => useCardPicture(side, 'portrait'),
      { initialProps: { side: study_back } },
    );
    rerender({ side: study });

    probeOf('study.png').load('portrait');
    probeOf('study_back.png').load('portrait');

    expect(result.current?.url).toBe('https://arkhamdb.com/bundles/cards/study.png');
    expect(result.current?.shown).toBe(true);
  });
});
