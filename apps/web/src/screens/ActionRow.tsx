import { useId, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { BoardView, CardActionView, InstanceId, PrintedActionView } from '@arkham/engine';
import type { GameActions } from '../state/gameActions';
import { useCluePayment } from './CluePaymentDialog';
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
 * that count off an action with the game's action arrow, and those that take none with its
 * free-ability symbol (action_row.css).
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
  cost?: 'action' | 'free';
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
 * The words for an offered card action: its short `caption` ("Resign", "Action 2" for the second
 * of a card's plain actions, `CardActionView.number`) and its full `name` ("Resign · Parlor"),
 * shared by the turn row and the card screens so both say the same.
 */
export function cardActionLabel(
  t: TFunction,
  offer: CardActionView,
): { caption: string; name: string } {
  const caption = cardActionCaption(t, offer);
  return { caption, name: t('investigators.cardActionOn', { action: caption, card: offer.card }) };
}

/**
 * The short name of a card action, offered or printed: its designator ("Resign") or "Action",
 * numbered when the card prints more than one of its kind ("Action 2", `PrintedActionView.number`).
 */
export function cardActionCaption(t: TFunction, { designator, number }: PrintedActionView): string {
  const kind = t(`investigators.cardAction.${designator ?? 'plain'}`);
  return number === undefined
    ? kind
    : t('investigators.cardActionNumbered', { action: kind, number });
}

/**
 * The card actions of one card (`cardActionsOn`) as a group of the action row, each named like
 * the turn row's button ("Resign · Parlor") and marked with the action arrow, or the free-ability symbol when it is free.
 * Taking one calls `onUse` first, so a window around it closes, since its effects may ask something
 * next or take the investigator out of the game (Resign); one with a group clue cost asks who pays
 * first (`useCluePayment`).
 */
export function CardActions({
  board,
  offered,
  actions,
  busy,
  onUse,
}: {
  board: BoardView;
  offered: readonly CardActionView[];
  actions: GameActions;
  busy: boolean;
  onUse?: () => void;
}) {
  const { t } = useTranslation();
  const { dialog, pay } = useCluePayment(board);
  return (
    <ActionGroup title={t('cardActions.title')}>
      {offered.map((offer) => {
        const { cardId, action, designator, free, groupClues } = offer;
        const { caption, name } = cardActionLabel(t, offer);
        return (
          <ActionButton
            key={action}
            icon={designator ?? 'cardAction'}
            cost={free ? 'free' : 'action'}
            caption={caption}
            name={name}
            disabled={busy}
            onClick={() =>
              pay(groupClues, cardId, (spend) => {
                onUse?.();
                void actions.useCardAction(cardId, action, spend);
              })
            }
          />
        );
      })}
      {dialog}
    </ActionGroup>
  );
}
