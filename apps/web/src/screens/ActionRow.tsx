import { useId, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { BoardView, CardActionView, InstanceId } from '@arkham/engine';
import type { GameActions } from '../state/gameActions';
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
  | 'clue'
  | 'resign'
  | 'parley'
  | 'cardAction';

/**
 * A titled group of buttons in a details window's action row (the enemy's, the location's, the
 * agenda's and act's full card, the card zoom): the row is the window's `footer`, and the
 * stylesheet sets the groups side by side.
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

/**
 * The card actions the card `cardId` offers the investigator whose turn it is
 * (`BoardView.cardActions`); none between turns. The details windows show them on the card that
 * prints them, besides the turn row's buttons for every card.
 */
export function cardActionsOn(board: BoardView, cardId: InstanceId): readonly CardActionView[] {
  return board.turn === undefined
    ? []
    : board.cardActions(board.turn).filter((offered) => offered.cardId === cardId);
}

/**
 * The words for an offered card action: its short `caption` ("Resign") and its full `name`
 * ("Resign · Parlor"), shared by the turn row and the card screens so both say the same.
 */
export function cardActionLabel(
  t: TFunction,
  { card, designator }: CardActionView,
): { caption: string; name: string } {
  const caption = t(`investigators.cardAction.${designator ?? 'plain'}`);
  return { caption, name: t('investigators.cardActionOn', { action: caption, card }) };
}

/**
 * The card actions of one card (`cardActionsOn`) as a group of the action row, each named like
 * the turn row's button ("Resign · Parlor") and marked with the action arrow unless it is free.
 * Taking one closes the window first (`onUse`), since its effects may ask something next or take
 * the investigator out of the game (Resign).
 */
export function CardActions({
  offered,
  actions,
  busy,
  onUse,
}: {
  offered: readonly CardActionView[];
  actions: GameActions;
  busy: boolean;
  onUse: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ActionGroup title={t('cardActions.title')}>
      {offered.map((offer) => {
        const { cardId, action, designator, free } = offer;
        const { caption, name } = cardActionLabel(t, offer);
        return (
          <ActionButton
            key={action}
            icon={designator ?? 'cardAction'}
            cost={free ? undefined : 'action'}
            caption={caption}
            name={name}
            disabled={busy}
            onClick={() => {
              onUse();
              void actions.useCardAction(cardId, action);
            }}
          />
        );
      })}
    </ActionGroup>
  );
}
