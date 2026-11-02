import { useTranslation } from 'react-i18next';
import type { BoardView, CardFaceView, InvestigatorView } from '@arkham/engine';
import { CardActions, cardActionsOn } from '../screens/ActionRow';
import { DetailsDialog, useDecisionHost } from '../screens/DetailsDialog';
import { useBackCloses } from '../screens/useBackCloses';
import type { GameActions } from '../state/gameActions';
import { TreacheryCard } from '../treacheries/TreacheryCard';

/** Where a card an investigator holds lies: in their threat area or their play area. */
export type HeldIn = 'threatArea' | 'playArea';

/**
 * A card in an investigator's threat area or play area (`heldIn`), opened by a tap on its small
 * card, on the card shell (`DetailsDialog`, MD.6b1):
 * - the card beside the page, a treachery's front drawn as its card (`TreacheryCard`), any other
 *   card as its picture, tapped to read it whole (`CardZoom`);
 * - whose area it lies in as the kicker, with their portrait;
 * - the card actions it offers the investigator whose turn it is (`CardActions`).
 * A card action keeps it open and shows the decision it raises in place of its page
 * (`useDecisionHost`), so a test to discard follows beside the same card. Once the card leaves
 * play the small card goes, and with it this dialog. Escape and its × close it; on a phone it is
 * the shell's sheet and the back gesture closes it too (`useBackCloses`).
 */
export function CardDetails({
  board,
  card,
  owner,
  heldIn,
  actions,
  busy,
  onClose,
}: {
  board: BoardView;
  card: CardFaceView;
  owner: InvestigatorView;
  heldIn: HeldIn;
  actions: GameActions;
  busy: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const close = useBackCloses(onClose);
  const hosted = useDecisionHost();
  const offered = cardActionsOn(board, card.id);
  return (
    <DetailsDialog
      board={board}
      actions={actions}
      busy={busy}
      hosted={hosted}
      name="held-card"
      card={card}
      drawn={card.type === 'treachery' ? <TreacheryCard card={card} /> : undefined}
      actor={owner}
      kicker={t(`cardDetails.${heldIn}`, { name: owner.name })}
      title={card.name}
      onClose={close}
    >
      <p>{t('cardDetails.tapToRead')}</p>
      {offered.length > 0 && (
        <footer>
          <CardActions
            board={board}
            offered={offered}
            actions={actions}
            busy={busy}
            onUse={hosted.host}
          />
        </footer>
      )}
    </DetailsDialog>
  );
}
