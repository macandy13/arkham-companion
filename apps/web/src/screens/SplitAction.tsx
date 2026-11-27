import { useId, useState } from 'react';
import { ActionButton, type ActionIcon } from './ActionRow';
import { useDismiss } from './useDismiss';

/** One way to take an action: a line of a `SplitAction`'s menu, or the tap of its pill. */
export interface ActionWay {
  /** Unique among the action's ways (the React key). */
  key: string;
  /** Its full name, also the menu line ("Fight · 1 action", "Fight by card effect · Daisy Walker"). */
  name: string;
  /** The actions it counts off, as `ActionButton.actions`: 0 free, none for a card effect. */
  actions?: number;
  onPick: () => void;
}

/**
 * One action of a details window's action row as a single pill (ME.31): a tap takes it the
 * usual way, the turn investigator's `primary` with its cost arrows, and a ⋮ beside it opens a
 * menu of every way, `primary` first, then the other `ways` (without an action, by card effect
 * for each investigator). Without a `primary`, as outside an investigator's turn, the pill
 * itself opens the menu. One pill per action instead of a button per way keeps the row short:
 * the other ways are rare, but must stay one step away. The menu closes on a pick, Escape (which
 * then does not close the window around it) or a press elsewhere.
 */
export function SplitAction({
  icon,
  caption,
  waysName,
  primary,
  ways,
  disabled,
}: {
  icon: ActionIcon;
  caption: string;
  /** Names the menu and the control that opens it ("Ways to fight"). */
  waysName: string;
  primary?: ActionWay;
  ways: readonly ActionWay[];
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const { ref, onKeyDown } = useDismiss<HTMLDivElement>(open, () => setOpen(false));

  if (primary !== undefined && ways.length === 0)
    return (
      <ActionButton
        icon={icon}
        {...(primary.actions === undefined ? {} : { actions: primary.actions })}
        caption={caption}
        name={primary.name}
        disabled={disabled}
        onClick={primary.onPick}
      />
    );
  const all = primary === undefined ? ways : [primary, ...ways];
  if (all.length === 0) return null;
  const toggle = {
    'aria-expanded': open,
    'aria-controls': menuId,
    onClick: () => setOpen(!open),
  };
  return (
    <div ref={ref} data-split onKeyDown={onKeyDown}>
      {primary === undefined ? (
        <button
          type="button"
          data-icon={icon}
          aria-label={waysName}
          disabled={disabled}
          {...toggle}
        >
          {caption}
        </button>
      ) : (
        <>
          <ActionButton
            icon={icon}
            {...(primary.actions === undefined ? {} : { actions: primary.actions })}
            caption={caption}
            name={primary.name}
            disabled={disabled}
            onClick={primary.onPick}
          />
          <button
            type="button"
            data-icon="more"
            aria-label={waysName}
            disabled={disabled}
            {...toggle}
          />
        </>
      )}
      {open && (
        <ul id={menuId} aria-label={waysName}>
          {all.map((way) => (
            <li key={way.key}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setOpen(false);
                  way.onPick();
                }}
              >
                {way.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
