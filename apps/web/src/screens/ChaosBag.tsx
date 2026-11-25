import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addChaosToken,
  type BoardView,
  type ChaosToken,
  type PoolToken,
  releaseChaosToken,
  removeChaosToken,
  revealTokens,
  sealChaosToken,
  tokenCounts,
} from '@arkham/engine';
import { ChaosTokenFace } from '../tokens/ChaosTokenFace';
import './chaos_bag.css';
import { usePlay } from './PlayContext';

/** The tokens a card adds from their pool, in the order the chaos bag lists them. */
const POOL_TOKENS: readonly PoolToken[] = ['bless', 'curse'];

/**
 * The chaos bag in its own dialog (M6.1b, `ChaosBagButton`): what is in it, one row per kind of token in
 * `CHAOS_TOKENS` order with its count (a symbol's value is on the reference card, so the list
 * leaves it out to stay small), and the tokens player cards sealed, each with the
 * investigator holding it (`BoardView.sealedTokens`). The players seal a token as a card tells
 * them: they tap it in the bag, then the investigator whose card seals it; a sealed token has a
 * Release button. The bless and curse tokens follow on one line, each its count in the bag
 * between − (back to the pool) and + (from the pool, off while `BoardView.poolTokensLeft` is 0),
 * as a card says. Reveal draws as many tokens as the players set, as a card reveals them outside a
 * skill test (`revealTokens`), and shows them until Put back: they never leave the bag, so this
 * is no step and Undo has nothing to take back.
 * Each other control is a performed step of its own (`SealChaosToken`, `ReleaseChaosToken`,
 * `ChangeChaosBag`), so Undo takes it back, and they wait while a step is queued (`usePlay().busy`).
 */
export function ChaosBag({ board }: { board: BoardView }) {
  const { actions, busy } = usePlay();
  const { t } = useTranslation();
  const sealedId = useId();
  const revealId = useId();
  const [picked, setPicked] = useState<ChaosToken>();
  const [toReveal, setToReveal] = useState(1);
  const [revealed, setRevealed] = useState<readonly ChaosToken[]>([]);
  const counts = tokenCounts(board.chaosBag);
  const sealers = board.investigators.filter((investigator) => investigator.status === 'active');
  // Sealing can leave fewer tokens than the count set before it.
  const revealing = Math.max(1, Math.min(toReveal, board.chaosBag.length));
  const chosen = counts.some(({ token }) => token === picked) ? picked : undefined;
  return (
    <section aria-label={t('chaosBag.title')} data-part="chaos-bag">
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
                void actions.perform(sealChaosToken(chosen, investigator.id));
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
                onClick={() => void actions.perform(removeChaosToken(token, 'scenario'))}
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
                onClick={() => void actions.perform(addChaosToken(token, 'scenario'))}
              >
                +
              </button>
            </li>
          );
        })}
      </ul>
      <h3 id={revealId}>{t('chaosBag.reveal')}</h3>
      <div role="group" aria-labelledby={revealId}>
        <button
          type="button"
          aria-label={t('chaosBag.revealFewer')}
          disabled={revealing === 1}
          onClick={() => setToReveal(revealing - 1)}
        >
          −
        </button>
        <data value={revealing}>{revealing}</data>
        <button
          type="button"
          aria-label={t('chaosBag.revealMore')}
          disabled={revealing >= board.chaosBag.length}
          onClick={() => setToReveal(revealing + 1)}
        >
          +
        </button>
        <button
          type="button"
          disabled={board.chaosBag.length === 0}
          onClick={() => setRevealed(revealTokens(board.chaosBag, revealing, Math.random))}
        >
          {t('chaosBag.revealCount', { count: revealing })}
        </button>
      </div>
      {revealed.length > 0 && (
        <div role="group" aria-label={t('chaosBag.revealed')}>
          <ul>
            {revealed.map((token, index) => (
              <li key={index}>
                <ChaosTokenFace token={token} />
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setRevealed([])}>
            {t('chaosBag.putBack')}
          </button>
        </div>
      )}
      {board.sealedTokens.length > 0 && (
        <>
          <h3 id={sealedId}>{t('chaosBag.sealed')}</h3>
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
                  onClick={() => void actions.perform(releaseChaosToken(token, investigatorId))}
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
