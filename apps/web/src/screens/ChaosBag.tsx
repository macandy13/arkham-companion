import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tokenCounts, type BoardView, type ChaosToken } from '@arkham/engine';
import type { GameActions } from '../state/gameActions';
import { ChaosTokenFace } from '../tokens/ChaosTokenFace';
import { hasSymbol, signedOrUnknown } from '../tokens/tokenValue';
import './chaos_bag.css';

/**
 * The chaos bag on the scenario card's page (M6.1b): what is in it, one row per kind of token in
 * `CHAOS_TOKENS` order with its count, the chance to draw it and, for a token that shows a symbol,
 * its value in this game (`BoardView.tokenModifier`, "?" where the card or the test decides it,
 * M6.7b), and the tokens player cards sealed, each with the
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
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const sealedId = useId();
  const [picked, setPicked] = useState<ChaosToken>();
  const counts = tokenCounts(board.chaosBag);
  const sealers = board.investigators.filter((investigator) => investigator.status === 'active');
  const percent = new Intl.NumberFormat(i18n.language, {
    style: 'percent',
    maximumFractionDigits: 0,
  });
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
            </button>{' '}
            {hasSymbol(token) && token !== 'autoFail' && (
              <>
                <data value={board.tokenModifier(token) ?? ''}>
                  {signedOrUnknown(board.tokenModifier(token))}
                </data>{' '}
              </>
            )}
            <data value={count / board.chaosBag.length}>
              {percent.format(count / board.chaosBag.length)}
            </data>
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
