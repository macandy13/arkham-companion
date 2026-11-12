import { PaperBubble } from './PaperBubble';
import './counter_bubble.css';

/** What one button of the bubble says it does and whether it is off, as a stepper's side. */
export interface BubbleSide {
  label: string;
  disabled: boolean;
}

/**
 * One count the bubble steps (`CounterBubble`): its name (`label`, shown over its buttons when the
 * bubble steps more than one count), the count as shown (`value`), its − (`lower`) and + (`raise`),
 * and `onStep` with −1 or +1 for the count as shown.
 */
export interface BubbleCount {
  label: string;
  value: string;
  lower: BubbleSide;
  raise: BubbleSide;
  onStep: (delta: -1 | 1) => void;
}

/**
 * The − / + bubble of the counts on a card (M6.9, M6.10): opened by a double tap on the counter
 * or the card (`anchor`), it stands on paper over it, pointing at it, titled with what it changes
 * (`title`, such as "Roland Banks · Health" or "Study"), over each count (`counts`) between a −
 * and a + the size of a touch target; a count is named over its buttons where there are several
 * (a location's clues and doom). Each tap is one step. It is a `PaperBubble`, which places it and
 * closes it (`onClose`) on a press away, Escape, a scroll or a resize.
 */
export function CounterBubble({
  anchor,
  title,
  counts,
  onClose,
}: {
  anchor: Element;
  title: string;
  counts: readonly BubbleCount[];
  onClose: () => void;
}) {
  return (
    <PaperBubble anchor={anchor} title={title} kind="counter" onClose={onClose}>
      {counts.map((count) => (
        <section key={count.label} aria-label={count.label}>
          {counts.length > 1 && <h3>{count.label}</h3>}
          <button
            type="button"
            aria-label={count.lower.label}
            disabled={count.lower.disabled}
            onClick={() => count.onStep(-1)}
          >
            −
          </button>
          <output>{count.value}</output>
          <button
            type="button"
            aria-label={count.raise.label}
            disabled={count.raise.disabled}
            onClick={() => count.onStep(1)}
          >
            +
          </button>
        </section>
      ))}
    </PaperBubble>
  );
}
