import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './paper_bubble.css';

/**
 * What a bubble holds (`PaperBubble`): the − / + steps of a card's counts (`CounterBubble`) or what
 * a card does to a drawn chaos token (`DrawnTokenBubble`), each laid out by its own styles.
 */
export type BubbleKind = 'counter' | 'token';

/**
 * A small sheet of paper over the element it is about (`anchor`), pointing at it, titled with what
 * it changes (`title`) over its controls (`children`). A press anywhere else, or Escape, closes it
 * (`onClose`), as does a scroll or a resize, which would move the anchor away from under it.
 * It goes to the page's body, so a card's clipped panels can't cut it, or into the open dialog the
 * anchor lies in, since a modal dialog makes the rest of the page inert; custom properties place
 * it by the anchor's place on the screen, kept on the screen, above the anchor where it fits.
 */
export function PaperBubble({
  anchor,
  title,
  kind,
  onClose,
  children,
}: {
  anchor: Element;
  title: string;
  kind: BubbleKind;
  onClose: () => void;
  children: ReactNode;
}) {
  const bubble = useRef<HTMLElement>(null);
  const heading = useId();
  // On every render, not only a new anchor: its contents can change its size (a count, a next step).
  useLayoutEffect(() => {
    const element = bubble.current;
    if (!element) return;
    const target = anchor.getBoundingClientRect();
    const { width, height } = element.getBoundingClientRect();
    const margin = lengthInPixels(getComputedStyle(element).getPropertyValue('--bubble-margin'));
    const centre = target.left + target.width / 2;
    const left = Math.max(margin, Math.min(window.innerWidth - width - margin, centre - width / 2));
    // Above the anchor where it fits, else below it, as on the top edge of a phone held sideways.
    const below = target.top - height - margin < 0;
    element.style.setProperty('--bubble-left', `${left}px`);
    element.style.setProperty(
      '--bubble-top',
      `${below ? target.bottom + margin : target.top - height - margin}px`,
    );
    element.style.setProperty('--bubble-arrow', `${centre - left}px`);
    element.toggleAttribute('data-below', below);
  });
  useEffect(() => {
    const away = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!bubble.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    // Caught first and kept from the dialog around it, so Escape closes the bubble alone.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    // It stays where it was placed, so it closes once the anchor moves away under it.
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
    <aside ref={bubble} aria-labelledby={heading} data-bubble={kind}>
      <h2 id={heading}>{title}</h2>
      {children}
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
