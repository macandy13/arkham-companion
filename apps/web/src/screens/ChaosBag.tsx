import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CHAOS_TOKENS, type BoardView, type ChaosToken, type InvestigatorId } from '@arkham/engine';
import type { GameActions } from '../state/gameActions';
import './chaos_bag.css';

/**
 * The chaos bag on the scenario card's page (M6.1b): what is in it, one row per kind of token in
 * `CHAOS_TOKENS` order with its count, and the tokens player cards sealed, each with the
 * investigator holding it (`BoardView.sealedTokens`). The players seal a token as a card tells
 * them: they tap it in the bag, then the investigator whose card seals it; a sealed token has a
 * Release button. Both are steps of their own (`GameActions.sealToken`, `releaseToken`), so Undo
 * takes them back, and they wait while a step is queued (`busy`).
 */
export function ChaosBag({
  board,
  actions,
  busy,
}: {
  board: BoardView;
  actions: GameActions;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const [picked, setPicked] = useState<ChaosToken>();
  const counts = tokenCounts(board.chaosBag);
  const sealers = board.investigators.filter((investigator) => investigator.status === 'active');
  const nameOf = (id: InvestigatorId) =>
    board.investigators.find((investigator) => investigator.id === id)?.name ?? id;
  const chosen = picked !== undefined && counts.has(picked) ? picked : undefined;
  return (
    <section aria-labelledby={titleId} data-part="chaos-bag">
      <h3 id={titleId}>{t('chaosBag.title')}</h3>
      <ul aria-label={t('chaosBag.contents')}>
        {[...counts].map(([token, count]) => (
          <li key={token}>
            <button
              type="button"
              aria-pressed={token === chosen}
              disabled={busy}
              onClick={() => setPicked(token === chosen ? undefined : token)}
            >
              <span data-token={token}>{t(`chaosToken.${token}`)}</span>{' '}
              <data value={count}>×{count}</data>
            </button>
          </li>
        ))}
      </ul>
      {chosen !== undefined && (
        <footer>
          {sealers.map((investigator) => (
            <button
              key={investigator.id}
              type="button"
              disabled={busy}
              onClick={() => {
                setPicked(undefined);
                void actions.sealToken(investigator.id, chosen);
              }}
            >
              {t('chaosBag.sealOn', {
                token: t(`chaosToken.${chosen}`),
                investigator: investigator.name,
              })}
            </button>
          ))}
        </footer>
      )}
      {board.sealedTokens.length > 0 && (
        <>
          <h4>{t('chaosBag.sealed')}</h4>
          <ul aria-label={t('chaosBag.sealed')}>
            {board.sealedTokens.map(({ token, investigatorId }, index) => (
              <li key={index}>
                <span data-token={token}>{t(`chaosToken.${token}`)}</span>{' '}
                {t('chaosBag.sealedOn', { investigator: nameOf(investigatorId) })}{' '}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void actions.releaseToken(investigatorId, token)}
                >
                  {t('chaosBag.release')}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** How many of each token `bag` holds, in `CHAOS_TOKENS` order, leaving out those it has none of. */
export function tokenCounts(bag: readonly ChaosToken[]): Map<ChaosToken, number> {
  const counts = new Map<ChaosToken, number>();
  for (const token of CHAOS_TOKENS) {
    const count = bag.filter((each) => each === token).length;
    if (count > 0) counts.set(token, count);
  }
  return counts;
}
