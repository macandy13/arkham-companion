import { useId, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addChaosToken,
  CHAOS_TOKENS,
  isPoolToken,
  type BoardView,
  type ChaosBagChangeLasts,
  type ChangeChaosBag,
  type ChaosToken,
  releaseChaosToken,
  removeChaosToken,
  revealTokens,
  sealChaosToken,
  type SealChaosToken,
  tokenCounts,
} from '@arkham/engine';
import { cycledIndex } from '@arkham/util';
import { ChaosTokenFace } from '../tokens/ChaosTokenFace';
import { useDismiss } from './useDismiss';
import './chaos_bag.css';
import { usePlay } from './PlayContext';

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
 *   `CHAOS_TOKENS` order by `tokenCounts`), as the players would tip it out on the table. A token
 *   is changed where it's shown (ME.30d): a tap opens the app's menu under the tray to seal it on
 *   an investigator (M6.1b) or remove it, a bless or curse token back to its pool. The tray ends
 *   on a dashed token whose menu adds any kind (ME.29b), a bless or curse token from its pool
 *   (off while `BoardView.poolTokensLeft` is 0). In a campaign game the players pick whether an
 *   added or removed token counts for the scenario or for the rest of the campaign (which the
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
  const closeMenus = () => {
    setPicked(undefined);
    setAdding(false);
  };
  const { ref, onKeyDown } = useDismiss<HTMLUListElement>(
    picked !== undefined || adding,
    closeMenus,
  );
  const change = (command: ChangeChaosBag | SealChaosToken) => {
    closeMenus();
    void actions.perform(command);
  };
  // A bless or curse token goes back to its pool for the scenario; the engine keeps it there.
  const removals = (token: ChaosToken): readonly ChaosBagChangeLasts[] =>
    isPoolToken(token) || !board.inCampaign ? ['scenario'] : LASTS;
  const removeLabel = (token: ChaosToken, duration: ChaosBagChangeLasts) => {
    if (isPoolToken(token)) return 'chaosBag.returnToPool';
    return board.inCampaign ? `chaosBag.removeFor.${duration}` : 'chaosBag.remove';
  };
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
          <ul ref={ref} aria-label={t('chaosBag.contents')} data-part="tray" onKeyDown={onKeyDown}>
            {tray.map((each) => {
              const open = each === chosen;
              const name = t(`chaosToken.${each.token}`);
              return (
                <li key={`${each.token}-${each.nth}`}>
                  <button
                    type="button"
                    data-menu
                    aria-expanded={open}
                    disabled={busy}
                    onClick={() => setPicked(open ? undefined : each)}
                  >
                    <ChaosTokenFace token={each.token} />
                  </button>
                  {open && (
                    <ul aria-label={t('chaosBag.pickedActions', { token: name })}>
                      {sealers.map((investigator) => (
                        <li key={investigator.id}>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => change(sealChaosToken(each.token, investigator.id))}
                          >
                            {t('chaosBag.sealOn', { token: name, investigator: investigator.name })}
                          </button>
                        </li>
                      ))}
                      {removals(each.token).map((lasts) => (
                        <li key={lasts}>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => change(removeChaosToken(each.token, lasts))}
                          >
                            {t(removeLabel(each.token, lasts), { token: name })}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
            <li>
              <button
                type="button"
                data-icon="add"
                aria-label={t('chaosBag.add')}
                aria-expanded={adding}
                disabled={busy}
                onClick={() => {
                  setPicked(undefined);
                  setAdding(!adding);
                }}
              />
              {adding && (
                <section aria-label={t('chaosBag.add')}>
                  {board.inCampaign && (
                    <ul aria-label={t('chaosBag.lasts.title')}>
                      {LASTS.map((duration) => (
                        <li key={duration}>
                          <button
                            type="button"
                            aria-pressed={duration === lasts}
                            onClick={() => setLasts(duration)}
                          >
                            {t(`chaosBag.lasts.${duration}`)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <ul aria-label={t('chaosBag.addWhich')} data-part="addable">
                    {CHAOS_TOKENS.map((token) => (
                      <li key={token}>
                        <button
                          type="button"
                          aria-label={t('chaosBag.addToken', { token: t(`chaosToken.${token}`) })}
                          disabled={
                            busy || (isPoolToken(token) && board.poolTokensLeft(token) === 0)
                          }
                          onClick={() =>
                            change(
                              addChaosToken(token, isPoolToken(token) ? 'scenario' : changeLasts),
                            )
                          }
                        >
                          <ChaosTokenFace token={token} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </li>
          </ul>
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
