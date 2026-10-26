import { useId, type ReactNode } from 'react';
import './action_row.css';

/** The icons an `ActionButton` shows, each a mask in `action_row.css`. */
export type ActionIcon =
  | 'fight'
  | 'evade'
  | 'engage'
  | 'damage'
  | 'disengage'
  | 'defeat'
  | 'investigate'
  | 'move'
  | 'clue';

/**
 * A titled group of buttons in a details window's action row (the enemy's, the location's): the
 * row is the window's `footer`, and the stylesheet sets the groups side by side.
 */
export function ActionGroup({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId}>
      <h3 id={titleId}>{title}</h3>
      {children}
    </section>
  );
}

/**
 * A button of the action row: its icon over a short `caption`, named in full by `name` (which
 * contains the caption, so speech input finds it by the word it shows); `cost` marks the ones
 * that count off an action, which the stylesheet marks with the game's action arrow.
 */
export function ActionButton({
  icon,
  cost,
  caption,
  name,
  disabled,
  onClick,
}: {
  icon: ActionIcon;
  cost?: 'action';
  caption: string;
  name: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-icon={icon}
      data-cost={cost}
      aria-label={name}
      disabled={disabled}
      onClick={onClick}
    >
      {caption}
    </button>
  );
}
