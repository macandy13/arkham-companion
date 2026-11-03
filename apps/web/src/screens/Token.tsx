import { useTranslation } from 'react-i18next';
import { deltaText, useCountChange } from './countChange';
import type { TokenDragHandlers } from './useTokenDrag';

/**
 * A big round token on a header card (agenda, act or encounter deck), like the doom and clue tokens
 * on the table (on the deck it counts the cards left): the `count` and, when the card has one, its
 * `threshold` under it ("2 of 7"). `label` says it in words for screen readers, since the token's
 * colour alone says what it counts. A `span`, so it may sit inside a button (the encounter deck).
 * A change of the count while it shows plays its effect (`useCountChange`). With `drag` a token can
 * be dragged off it (`useTokenDrag`), marked `data-drag` with its kind.
 */
export function Token({
  kind,
  count,
  threshold,
  label,
  drag,
}: {
  kind: 'doom' | 'clue' | 'cards';
  count: number;
  threshold?: number | undefined;
  label: string;
  drag?: TokenDragHandlers | undefined;
}) {
  const { t } = useTranslation();
  const change = useCountChange(count);
  return (
    <span role="img" aria-label={label} data-token={kind} data-drag={drag && kind} {...drag}>
      <data key={change?.key} value={count} data-delta={deltaText(change)}>
        {count}
      </data>
      {threshold !== undefined && <span>{t('header.tokenThreshold', { threshold })}</span>}
    </span>
  );
}
