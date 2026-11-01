import { useRef, type ReactNode } from 'react';
import './card_strip.css';

/**
 * A row of cards that scrolls sideways a whole card at a time, as the threat area and the
 * encounter dialog's pile lay them out: past `shown` cards it gets an arrow on each side, and a
 * swipe or an arrow moves it by one card. The caller's stylesheet sizes the row to `shown` cards
 * and snaps it to whole cards; the children are the row's `li`s.
 */
export function CardStrip({
  label,
  count,
  shown,
  earlierLabel,
  laterLabel,
  children,
}: {
  /** The row's accessible name. */
  label: string;
  /** How many cards the row holds, to tell whether it overflows. */
  count: number;
  /** How many cards show side by side before the row scrolls. */
  shown: number;
  earlierLabel: string;
  laterLabel: string;
  children: ReactNode;
}) {
  const strip = useRef<HTMLUListElement>(null);
  // One card's width is enough: the strip snaps to whole cards, so the scroll ends on the next one.
  const scroll = (direction: -1 | 1) => {
    const card = strip.current?.firstElementChild;
    if (card instanceof HTMLElement)
      strip.current?.scrollBy({ left: direction * card.offsetWidth, behavior: 'smooth' });
  };
  const overflowing = count > shown;
  return (
    <div>
      {overflowing && (
        <button
          type="button"
          data-icon="previous"
          aria-label={earlierLabel}
          onClick={() => scroll(-1)}
        />
      )}
      <ul ref={strip} aria-label={label}>
        {children}
      </ul>
      {overflowing && (
        <button type="button" data-icon="next" aria-label={laterLabel} onClick={() => scroll(1)} />
      )}
    </div>
  );
}
