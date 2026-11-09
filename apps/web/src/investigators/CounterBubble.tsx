import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './counter_bubble.css';

/** What one button of the bubble says it does and whether it is off, as a stepper's side. */
export interface BubbleSide {
  label: string;
  disabled: boolean;
}

/**
 * The − / + bubble of a counter on the investigator's card (M6.9): opened by a double tap on the
 * counter (`anchor`), it stands on paper over it, pointing at it, titled with what it changes
 * (`label`, such as "Roland Banks · Health"), over its count (`value`) between a − and a + the size of a touch target. Each tap is one step
 * (`onStep` with −1 or +1 for the count as shown). A press anywhere else, or Escape, closes it
 * (`onClose`), as does a scroll or a resize, which would move the counter away from under it.
 * It goes to the page's body, so the card's clipped panels can't cut it, or into the
 * open dialog the counter lies in (the whole card), since a modal dialog makes the rest of the page
 * inert; custom properties place it by the counter's place on the screen, kept on the screen.
 */
export function CounterBubble({
  anchor,
  label,
  value,
  lower,
  raise,
  onStep,
  onClose,
}: {
  anchor: HTMLElement;
  label: string;
  value: string;
  lower: BubbleSide;
  raise: BubbleSide;
  onStep: (delta: -1 | 1) => void;
  onClose: () => void;
}) {
  const bubble = useRef<HTMLElement>(null);
  const title = useId();
  useLayoutEffect(() => {
    const element = bubble.current;
    if (!element) return;
    const counter = anchor.getBoundingClientRect();
    const { width, height } = element.getBoundingClientRect();
    const margin = lengthInPixels(getComputedStyle(element).getPropertyValue('--bubble-margin'));
    const centre = counter.left + counter.width / 2;
    const left = Math.max(margin, Math.min(window.innerWidth - width - margin, centre - width / 2));
    // Above the counter where it fits, else below it, as on the top edge of a phone held sideways.
    const below = counter.top - height - margin < 0;
    element.style.setProperty('--bubble-left', `${left}px`);
    element.style.setProperty(
      '--bubble-top',
      `${below ? counter.bottom + margin : counter.top - height - margin}px`,
    );
    element.style.setProperty('--bubble-arrow', `${centre - left}px`);
    element.toggleAttribute('data-below', below);
  }, [anchor]);
  useEffect(() => {
    const away = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!bubble.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    // Caught first and kept from the whole card's dialog, so Escape closes the bubble alone.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    // It stays where it was placed, so it closes once the counter moves away under it.
    const moved = () => onClose();
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', escape, true);
    document.addEventListener('scroll', moved, true);
    window.addEventListener('resize', moved);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', escape, true);
      document.removeEventListener('scroll', moved, true);
      window.removeEventListener('resize', moved);
    };
  }, [anchor, onClose]);
  return createPortal(
    <aside ref={bubble} aria-labelledby={title} data-counter-bubble="">
      <h2 id={title}>{label}</h2>
      <button
        type="button"
        aria-label={lower.label}
        disabled={lower.disabled}
        onClick={() => onStep(-1)}
      >
        −
      </button>
      <output>{value}</output>
      <button
        type="button"
        aria-label={raise.label}
        disabled={raise.disabled}
        onClick={() => onStep(1)}
      >
        +
      </button>
    </aside>,
    anchor.closest('dialog') ?? document.body,
  );
}

/**
 * A custom property's length in pixels: custom properties keep the units they were written in,
 * so a `rem` length is scaled by the root's font size.
 */
export function lengthInPixels(length: string, rootFontSize = rootFontPixels()): number {
  const value = Number.parseFloat(length);
  return length.trim().endsWith('rem') ? value * rootFontSize : value;
}

/** The root element's font size in pixels, which `rem` lengths count in. */
function rootFontPixels(): number {
  return Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
}
