import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { InvestigatorView } from '@arkham/engine';
import { range } from '@arkham/util';
import { CardDialog } from '../screens/CardDialog';
import { GameToken } from '../tokens/GameToken';
import './play_card.css';

/**
 * How many resources are paid once the `token`-th one (from 0) is tapped while `pays` are: up to
 * and with it, so one tap pays a card's whole cost; tapping the last paid one takes it back.
 */
export function paysAfterTap(pays: number, token: number): number {
  return token === pays - 1 ? token : token + 1;
}

/**
 * The play action's sheet (M6.8): the investigator who plays stands over the page (the card
 * dialog shell's `actor`), their resources lie on it as tokens to tap, as the clue payment's
 * clues do, and its foot plays the card without paying or, the brass primary, pays what is tapped
 * (`onPlay` with the cost; `GameActions.playCard`). The players hold the card, so the sheet never
 * knows its cost. The × leaves without playing, so no action is spent.
 */
export function PlayCardDialog({
  investigator,
  onPlay,
  onClose,
}: {
  investigator: InvestigatorView;
  onPlay: (cost: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [pays, setPays] = useState(0);
  const held = investigator.resources;
  return (
    <CardDialog
      name="play-card"
      actor={investigator}
      kicker={investigator.name}
      title={t('playCard.title')}
      onCancel={onClose}
      onClose={onClose}
    >
      <p>{held > 0 ? t('playCard.tapResources') : t('playCard.noResources')}</p>
      <ul aria-label={t('playCard.resources', { count: held })}>
        {range(held).map((token) => (
          <li key={token}>
            <button
              type="button"
              aria-label={t('playCard.resource', { number: token + 1 })}
              aria-pressed={token < pays}
              onClick={() => setPays(paysAfterTap(pays, token))}
            >
              <GameToken kind="resource" />
            </button>
          </li>
        ))}
      </ul>
      <p>{t('playCard.pays', { pays, left: held - pays })}</p>
      <footer>
        <button type="button" onClick={() => onPlay(0)}>
          {t('playCard.free')}
        </button>
        <button type="button" data-primary disabled={pays === 0} onClick={() => onPlay(pays)}>
          {t('playCard.pay', { count: pays })}
        </button>
      </footer>
    </CardDialog>
  );
}
