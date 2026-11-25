import { useId, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addChaosToken,
  CHAOS_TOKENS,
  isPoolToken,
  type BoardView,
  type ChaosBagChangeLasts,
  type ChaosToken,
  type PoolToken,
  releaseChaosToken,
  removeChaosToken,
  revealTokens,
  sealChaosToken,
  tokenCounts,
} from '@arkham/engine';
import { cycledIndex } from '@arkham/util';
import { ChaosTokenFace } from '../tokens/ChaosTokenFace';
import './chaos_bag.css';
import { usePlay } from './PlayContext';

/** The tokens a card adds from their pool, in the order the chaos bag lists them. */
const POOL_TOKENS: readonly PoolToken[] = ['bless', 'curse'];

/** The tokens a card adds to the bag as they are, every kind but those that come from a pool. */
const ADDABLE_TOKENS: readonly ChaosToken[] = CHAOS_TOKENS.filter((token) => !isPoolToken(token));

/** How long a change to the bag can last, in the order the chaos bag offers them. */
const LASTS: readonly ChaosBagChangeLasts[] = ['scenario', 'campaign'];

/** The dialog's three views of the bag, its tabs in this order. */
const VIEWS = ['bag', 'sealed', 'reveal'] as const;
type BagView = (typeof VIEWS)[number];

/** One token in the tray: which kind it is, and which of the bag's tokens of that kind (from 0). */
interface TrayToken {
  token: ChaosToken;
  nth: number;
}

/**
 * The chaos bag in its own dialog (`ChaosBagButton`), laid out as a token tray (ME.32b) with three
 * tabs, so each view stays short:
 * - In the bag: every token in it laid out one by one on a felt tray (`BoardView.chaosBag`, in
 *   `CHAOS_TOKENS` order by `tokenCounts`), as the players would tip it out on the table. The players
 *   seal a token as a card tells them (M6.1b): they tap it, then the investigator whose card seals
 *   it, or remove it. Under the tray the bless and curse tokens, each its count in the bag between −
 *   (back to the pool) and + (from the pool, off while `BoardView.poolTokensLeft` is 0), and Add a
 *   token for any other kind (ME.29b), as a card says. In a campaign game the players pick whether
 *   an added or removed token counts for the scenario or for the rest of the campaign (which the
 *   resolution writes into the campaign log); a standalone game has only the scenario.
 * - Sealed: the tokens player cards sealed, each with the investigator holding it
 *   (`BoardView.sealedTokens`) and a Release button.
 * - Reveal: draws as many tokens as the players set, as a card reveals them outside a skill test
 *   (`revealTokens`), and shows them until Put back: they never leave the bag, so this is no step
 *   and Undo has nothing to take back.
 * Each other control is a performed step of its own (`SealChaosToken`, `ReleaseChaosToken`,
 * `ChangeChaosBag`), so Undo takes it back, and they wait while a step is queued (`usePlay().busy`).
 */
export function ChaosBag({ board }: { board: BoardView }) {
  const { actions, busy } = usePlay();
  const { t } = useTranslation();
  const tabsId = useId();
  const changeId = useId();
  const [lasts, setLasts] = useState<ChaosBagChangeLasts>('scenario');
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<BagView>('bag');
  const [picked, setPicked] = useState<TrayToken>();
  const [toReveal, setToReveal] = useState(1);
  const [revealed, setRevealed] = useState<readonly ChaosToken[]>([]);
  const tray = tokenCounts(board.chaosBag).flatMap(({ token, count }) =>
    Array.from({ length: count }, (_, nth): TrayToken => ({ token, nth })),
  );
  const sealers = board.investigators.filter((investigator) => investigator.status === 'active');
  // Sealing can leave fewer tokens than the count set before it.
  const revealing = Math.max(1, Math.min(toReveal, board.chaosBag.length));
  const changeLasts = board.inCampaign ? lasts : 'scenario';
  // A step taken elsewhere (Undo) can take the picked token out of the bag.
  const chosen = tray.find((each) => each.token === picked?.token && each.nth === picked.nth);
  const tabLabel: Record<BagView, string> = {
    bag: t('chaosBag.inBag', { count: board.chaosBag.length }),
    sealed: t('chaosBag.sealedCount', { count: board.sealedTokens.length }),
    reveal: t('chaosBag.reveal'),
  };
  const tabId = (each: BagView) => `${tabsId}-${each}`;
  const panelId = `${tabsId}-panel`;
  // The tabs pattern (WAI-ARIA), as the map's tabs: the row is one stop for Tab, the arrow keys
  // choose the view and move the focus with it, Home and End go to the first and last.
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = VIEWS.indexOf(view);
    const next: Record<string, number> = {
      ArrowRight: cycledIndex(at, 1, VIEWS.length),
      ArrowLeft: cycledIndex(at, -1, VIEWS.length),
      Home: 0,
      End: VIEWS.length - 1,
    };
    const index = next[event.key];
    const chosenView = index === undefined ? undefined : VIEWS[index];
    if (!chosenView) return;
    event.preventDefault();
    setView(chosenView);
    document.getElementById(tabId(chosenView))?.focus();
  };
  return (
    <section aria-label={t('chaosBag.title')} data-part="chaos-bag">
      <div role="tablist" aria-label={t('chaosBag.views')} onKeyDown={onTabKey}>
        {VIEWS.map((each) => (
          <button
            key={each}
            type="button"
            role="tab"
            id={tabId(each)}
            aria-selected={each === view}
            aria-controls={panelId}
            tabIndex={each === view ? 0 : -1}
            onClick={() => setView(each)}
          >
            {tabLabel[each]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(view)}>
        {view === 'bag' && (
          <>
            <ul aria-label={t('chaosBag.contents')} data-part="tray">
              {tray.map((each) => (
                <li key={`${each.token}-${each.nth}`}>
                  <button
                    type="button"
                    aria-pressed={each === chosen}
                    disabled={busy}
                    onClick={() => setPicked(each === chosen ? undefined : each)}
                  >
                    <ChaosTokenFace token={each.token} />
                  </button>
                </li>
              ))}
            </ul>
            {chosen !== undefined && (
              <div
                role="group"
                aria-label={t('chaosBag.sealWhere', { token: t(`chaosToken.${chosen.token}`) })}
              >
                {sealers.map((investigator) => (
                  <button
                    key={investigator.id}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setPicked(undefined);
                      void actions.perform(sealChaosToken(chosen.token, investigator.id));
                    }}
                  >
                    {t('chaosBag.sealOn', {
                      token: t(`chaosToken.${chosen.token}`),
                      investigator: investigator.name,
                    })}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setPicked(undefined);
                    void actions.perform(removeChaosToken(chosen.token, changeLasts));
                  }}
                >
                  {t('chaosBag.remove', { token: t(`chaosToken.${chosen.token}`) })}
                </button>
              </div>
            )}
            <ul aria-label={t('chaosBag.pool')} data-part="pool">
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
            <div role="group" aria-labelledby={changeId}>
              <h3 id={changeId}>{t('chaosBag.change')}</h3>
              {board.inCampaign &&
                LASTS.map((duration) => (
                  <button
                    key={duration}
                    type="button"
                    aria-pressed={duration === changeLasts}
                    onClick={() => setLasts(duration)}
                  >
                    {t(`chaosBag.lasts.${duration}`)}
                  </button>
                ))}
              <button
                type="button"
                aria-expanded={adding}
                disabled={busy}
                onClick={() => setAdding(!adding)}
              >
                {t('chaosBag.add')}
              </button>
            </div>
            {adding && (
              <ul aria-label={t('chaosBag.addWhich')} data-part="addable">
                {ADDABLE_TOKENS.map((token) => (
                  <li key={token}>
                    <button
                      type="button"
                      aria-label={t('chaosBag.addToken', { token: t(`chaosToken.${token}`) })}
                      disabled={busy}
                      onClick={() => {
                        setAdding(false);
                        void actions.perform(addChaosToken(token, changeLasts));
                      }}
                    >
                      <ChaosTokenFace token={token} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {view === 'sealed' &&
          (board.sealedTokens.length === 0 ? (
            <p>{t('chaosBag.noneSealed')}</p>
          ) : (
            <ul aria-label={t('chaosBag.sealed')} data-part="sealed">
              {board.sealedTokens.map(({ token, investigatorId }, index) => (
                <li key={index}>
                  <ChaosTokenFace token={token} />{' '}
                  {t('chaosBag.sealedOn', {
                    investigator: board.investigator(investigatorId).name,
                  })}{' '}
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
          ))}
        {view === 'reveal' && (
          <>
            <p>{t('chaosBag.revealHint')}</p>
            <div role="group" aria-label={t('chaosBag.revealHowMany')}>
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
            </div>
            {revealed.length > 0 && (
              <ul aria-label={t('chaosBag.revealed')} data-part="revealed">
                {revealed.map((token, index) => (
                  <li key={index}>
                    <ChaosTokenFace token={token} />
                  </li>
                ))}
              </ul>
            )}
            <footer>
              {revealed.length > 0 && (
                <button type="button" onClick={() => setRevealed([])}>
                  {t('chaosBag.putBack')}
                </button>
              )}
              <button
                type="button"
                data-primary
                disabled={board.chaosBag.length === 0}
                onClick={() => setRevealed(revealTokens(board.chaosBag, revealing, Math.random))}
              >
                {t('chaosBag.revealCount', { count: revealing })}
              </button>
            </footer>
          </>
        )}
      </div>
    </section>
  );
}
