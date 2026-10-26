import { useTranslation } from 'react-i18next';

/**
 * A big round token on a header card (agenda, act or encounter deck), like the doom and clue tokens
 * on the table (on the deck it counts the cards left): the `count` and, when the card has one, its
 * `threshold` under it ("2 of 7"). `label` says it in words for screen readers, since the token's
 * colour alone says what it counts.
 */
export function Token({
  kind,
  count,
  threshold,
  label,
}: {
  kind: 'doom' | 'clue' | 'cards';
  count: number;
  threshold?: number | undefined;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <p role="img" aria-label={label} data-token={kind}>
      <data value={count}>{count}</data>
      {threshold !== undefined && <span>{t('header.tokenThreshold', { threshold })}</span>}
    </p>
  );
}
