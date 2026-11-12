import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tokenCounts, type BoardView, type ChaosToken, type PoolToken } from '@arkham/engine';
import type { GameActions } from '../state/gameActions';
import { ChaosTokenFace } from '../tokens/ChaosTokenFace';
import './chaos_bag.css';

/** The tokens a card adds from their pool, in the order the chaos bag lists them. */
const POOL_TOKENS: readonly PoolToken[] = ['bless', 'curse'];

/**
 * The chaos bag on the scenario card's page (M6.1b): what is in it, one row per kind of token in
 * `CHAOS_TOKENS` order with its count (a symbol's value is in the reference card's text above,
 * so the list leaves it out to stay small), and the tokens player cards sealed, each with the
 * investigator holding it (`BoardView.sealedTokens`). The players seal a token as a card tells
 * them: they tap it in the bag, then the investigator whose card seals it; a sealed token has a
 * Release button. The bless and curse tokens follow on one line, each its count in the bag
 * between − (back to the pool) and + (from the pool, off while `BoardView.poolTokensLeft` is 0),
 * as a card says.
 * Each is a step of its own (`GameActions.sealToken`, `releaseToken`, `addPoolToken`,
 * `removePoolToken`), so Undo takes it back, and they wait while a step is queued (`busy`).
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
  const sealedId = useId();
  const [picked, setPicked] = useState<ChaosToken>();
  const counts = tokenCounts(board.chaosBag);
  const sealers = board.investigators.filter((investigator) => investigator.status === 'active');
  const chosen = counts.some(({ token }) => token === picked) ? picked : undefined;
  return (
    <section aria-labelledby={titleId} data-part="chaos-bag">
      <h3 id={titleId}>{t('chaosBag.title')}</h3>
      <ul aria-label={t('chaosBag.contents')}>
        {counts.map(({ token, count }) => (
          <li key={token}>
            <button
              type="button"
              aria-pressed={token === chosen}
              disabled={busy}
              onClick={() => setPicked(token === chosen ? undefined : token)}
            >
              <ChaosTokenFace token={token} /> <data value={count}>×{count}</data>
            </button>
          </li>
        ))}
      </ul>
      {chosen !== undefined && (
        <div
          role="group"
          aria-label={t('chaosBag.sealWhere', { token: t(`chaosToken.${chosen}`) })}
        >
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
        </div>
      )}
      <ul aria-label={t('chaosBag.pool')}>
        {POOL_TOKENS.map((token) => {
          const inBag = board.chaosBag.filter((each) => each === token).length;
          const left = board.poolTokensLeft(token);
          const name = t(`chaosToken.${token}`);
          return (
            <li key={token}>
              <ChaosTokenFace token={token} />
              <button
                type="button"
                aria-label={t('chaosBag.returnToPool', { token: name })}
                disabled={busy || inBag === 0}
                onClick={() => void actions.removePoolToken(token)}
              >
                −
              </button>
              <data value={inBag} title={t('chaosBag.poolLeft', { count: left })}>
                ×{inBag}
              </data>
              <button
                type="button"
                aria-label={t('chaosBag.addFromPool', { token: name })}
                disabled={busy || left === 0}
                onClick={() => void actions.addPoolToken(token)}
              >
                +
              </button>
            </li>
          );
        })}
      </ul>
      {board.sealedTokens.length > 0 && (
        <>
          <h4 id={sealedId}>{t('chaosBag.sealed')}</h4>
          <ul aria-labelledby={sealedId}>
            {board.sealedTokens.map(({ token, investigatorId }, index) => (
              <li key={index}>
                <ChaosTokenFace token={token} />{' '}
                {t('chaosBag.sealedOn', { investigator: board.investigator(investigatorId).name })}{' '}
                <button
                  type="button"
                  aria-label={t('chaosBag.releaseFrom', {
                    token: t(`chaosToken.${token}`),
                    investigator: board.investigator(investigatorId).name,
                  })}
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
