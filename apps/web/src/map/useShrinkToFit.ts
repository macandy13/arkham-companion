import { useLayoutEffect, useState, type RefObject } from 'react';
import { shrinkToFit, type Point } from './mapLayout';

/**
 * How much the SVG text in `text` must shrink to fit `room` units (`shrinkToFit`), measured once
 * it is laid out and again when `content` changes, for a card's name on its name plate. It is 1
 * until then, and stays 1 in jsdom, which lays out no text.
 */
export function useShrinkToFit(
  text: RefObject<SVGTextElement | null>,
  room: number,
  content: string,
): number {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const element = text.current;
    if (!element?.getComputedTextLength) return;
    const fit = () => setScale(shrinkToFit(element.getComputedTextLength(), room));
    fit();
    // The display font may still be loading, and it sets the name's width.
    void document.fonts?.ready.then(fit);
  }, [text, room, content]);
  return scale;
}

/** The SVG transform that shrinks by `scale` around `centre`, or none when it keeps its size. */
export function shrinkAround(centre: Point, scale: number): string | undefined {
  return scale === 1
    ? undefined
    : `translate(${centre.x} ${centre.y}) scale(${scale}) translate(${-centre.x} ${-centre.y})`;
}
