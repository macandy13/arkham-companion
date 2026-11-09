import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './counter_bubble.css';

/** What one button of the bubble says it does and whether it is off, as a stepper's side. */
export interface BubbleSide {
  label: string;
  disabled: boolean;
}

/**
 * The − / + bubble of a counter on the investigator's card (M6.9): opened by a double tap on the
 * counter (`anchor`), it stands on paper over it, pointing at it, with what it is about (`label`),
 * its count (`value`) between a − and a + the size of a touch target. Each tap is one step
 * (`onStep` with −1 or +1 for the count as shown). A press anywhere else, or Escape, closes it
 * (`onClose`). It goes to the page's body, so the card's clipped panels can't cut it, or into the
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
  useLayoutEffect(() => {
    const element = bubble.current;
    if (!element) return;
    const counter = anchor.getBoundingClientRect();
    const { width, height } = element.getBoundingClientRect();
    const margin = Number.parseFloat(getComputedStyle(element).getPropertyValue('--bubble-margin'));
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
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [anchor, onClose]);
  return createPortal(
    <aside ref={bubble} aria-label={label} data-counter-bubble="">
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
