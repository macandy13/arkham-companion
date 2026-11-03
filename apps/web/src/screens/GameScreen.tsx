import { printedInvestigatorOf } from '@arkham/carddata';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { keyOf } from '@arkham/util';
import { gameId as toGameId, type DecisionId, type InstanceId } from '@arkham/engine';
import type { AppState } from '../state/appStore';
import { useCatalog, type CatalogSource } from '../catalog/useCatalog';
import { InvestigatorBar } from '../investigators/InvestigatorBar';
import { LocationFocus } from '../map/LocationFocus';
import { MapBoard } from '../map/MapBoard';
import { DecisionDialog } from './DecisionDialog';
import { DecisionHostContext } from './DetailsDialog';
import { DetailControls } from './DetailControls';
import { GameHeader, printedReferenceOf } from './GameHeader';
import { GameStatus } from './GameStatus';
import { MapStrip } from './MapStrip';
import { RejectionToast } from './RejectionToast';
import { DrawnCardsNotice } from '../encounter/DrawnCardsNotice';
import { ResolutionPrompt } from '../campaign/ResolutionPrompt';
import { SpawnPrompt } from '../encounter/SpawnPrompt';
import { SkippedEffectsNotice } from './SkippedEffectsNotice';
import { ChangesNotice } from '../log/ChangesNotice';
import { useDetailView } from './useDetailView';
import { usePhone } from './usePhone';
import { useVerticalSwipe } from './useVerticalSwipe';
import { swipeAction } from './detailSwipe';
import './game.css';

/**
 * Route `/game/:id`: loads the game named in the URL (so deep links and reloads work)
 * and shows the board layout of product.md "UI concept": the header, the status row, the map, the investigator bar,
 * the first open decision as a dialog, the reason when an action is refused, and the card effects it skipped. Until the game is open it says so, and
 * a game it cannot play (its scenario is not in the catalog) gets a warning instead of a board.
 *
 * On a phone held upright the board starts as the compact view (the stylesheet's phone blocks); a
 * tap on a header card, the map's expand button or the investigator's name opens the detail view
 * on it (`useDetailView`, `data-view` names its row): the header or the investigator bar expands
 * in place over the shrunk map, its places or panels snapped sideways, while the map takes the
 * whole screen (`DetailControls`) with a strip above and below it (`MapStrip`). A swipe down on
 * the header or up on the investigators expands them too, and the opposite swipe folds them
 * (`useVerticalSwipe`, `swipeAction`). A tap on a
 * location there or in the compact view shows that location in the map row (`LocationFocus`), the
 * location mode, until the players go back to the map; while they choose where an enemy spawns,
 * or pick the answer to the open decision on the map (`DecisionView.locations`), the map shows,
 * its pickable locations lit. Picking belongs to the decision it was started for, so the next
 * one opens raised; a tap on a location the decision cannot pick raises the dialog again. A
 * details dialog whose action raised the decision shows it in its own page instead
 * (`DecisionHostContext`), and the screen's decision dialog stays shut until it closes. The
 * scenario card's texts come from the card `catalog`.
 */
export function GameScreen({
  store,
  catalog,
}: {
  store: StoreApi<AppState>;
  catalog: CatalogSource;
}) {
  const { t } = useTranslation();
  const cards = useCatalog(catalog);
  // The route only matches with an `:id` segment; the fallback only satisfies the type.
  const gameId = toGameId(useParams().id ?? '');
  const current = useStore(store, (s) => s.current);
  const open = current?.gameId === gameId ? current : undefined;
  const phone = usePhone();
  const detail = useDetailView();
  const [pickingFor, setPickingFor] = useState<DecisionId>();
  const [hosted, setHosted] = useState(false);
  const boardElement = useRef<HTMLDivElement>(null);
  const detailTarget = phone ? detail.target : undefined;
  // The expanded header leaves the map and the investigator in view, so they open their rows from there.
  const showDetail = phone ? (detailTarget ? detail.go : detail.open) : undefined;

  useEffect(() => {
    void store.getState().openGame(gameId);
  }, [store, gameId]);

  // The whole-screen map takes every touch for panning, so only the board beside it swipes. The
  // board element only exists once the game has a board, so that turns the listeners on too.
  useVerticalSwipe(
    boardElement,
    showDetail !== undefined && detailTarget?.row !== 'map' && open?.board !== undefined,
    (direction, on) => {
      if (!open?.board || !showDetail) return;
      const action = swipeAction(direction, on, detailTarget?.row, open.board);
      if (action === 'close') detail.close();
      else if (action) showDetail(action);
    },
  );

  // Turned sideways the phone shows the whole board, so the hidden view closes with its entry.
  const { close: closeDetail } = detail;
  const detailOpen = detail.target !== undefined;
  useEffect(() => {
    if (!phone && detailOpen) closeDetail();
  }, [phone, detailOpen, closeDetail]);

  // Only a playable game has a board to read, so the board's parts get one and never check.
  if (!open?.board) {
    return (
      <>
        <h1>{t('app.title')}</h1>
        {open ? <p role="alert">{t('game.unplayable')}</p> : <p>{t('header.noGame')}</p>}
      </>
    );
  }
  const { board } = open;
  const [decision] = board.decisions;
  const decisionId = open.state.pending[0]?.id;
  const { spawning } = open;
  const picking =
    decision?.locations !== undefined && decisionId !== undefined && pickingFor === decisionId;
  const pickable = picking ? Object.values(decision?.locations ?? {}) : undefined;
  const pickAnswer = (location: InstanceId) => {
    setPickingFor(undefined);
    // A location option carries no counts or follow-up choice (`chooseLocation`), so its name alone answers it.
    const option = keyOf(decision?.locations ?? {}, location);
    if (option !== undefined) void store.getState().actions.answer(option);
  };
  const focusId = detailTarget?.row === 'map' ? detailTarget.location : undefined;
  // A location that left play, or a location to pick on the map, brings the whole map back.
  const focused =
    spawning || picking ? undefined : board.locations.find(({ id }) => id === focusId);
  const showLocation =
    showDetail && ((location: InstanceId) => showDetail({ row: 'map', location }));

  const host = {
    decision: decision && decisionId !== undefined ? { view: decision, id: decisionId } : undefined,
    adjusting: open.adjusting,
    setHosted,
  };

  return (
    <DecisionHostContext.Provider value={host}>
      <div
        id="board"
        ref={boardElement}
        data-view={detailTarget?.row}
        data-adjusting={open.adjusting || undefined}
        data-spawning={open.spawning ? true : undefined}
      >
        <GameHeader
          store={store}
          open={open}
          board={board}
          printedReference={
            board.reference && cards.status === 'ready'
              ? printedReferenceOf(cards.catalog, board.reference)
              : undefined
          }
          onOpenCard={
            showDetail && detailTarget?.row !== 'cards'
              ? (card) => showDetail({ row: 'cards', card })
              : undefined
          }
          full={detailTarget?.row === 'cards'}
        />
        <GameStatus store={store} open={open} board={board} />
        <section id="map" aria-labelledby="map-title">
          <h2 id="map-title">{t('map.title')}</h2>
          {showDetail && detailTarget?.row !== 'map' && (
            <button
              type="button"
              data-icon="expand"
              data-detail="expand"
              aria-label={t('detail.openMap')}
              onClick={() => showDetail({ row: 'map' })}
            />
          )}
          {detailTarget?.row === 'map' && <MapStrip board={board} to="cards" onGo={detail.go} />}
          {focused ? (
            <LocationFocus
              board={board}
              location={focused}
              actions={store.getState().actions}
              busy={open.busy}
              adjusting={open.adjusting}
              onGo={(location) => detail.go({ row: 'map', location })}
              onMap={() => detail.go({ row: 'map' })}
            />
          ) : (
            <MapBoard
              board={board}
              actions={store.getState().actions}
              busy={open.busy}
              adjusting={open.adjusting}
              onPick={
                spawning
                  ? (location) => {
                      store.getState().cancelSpawn();
                      void store.getState().actions.spawnEnemy(spawning.id, location);
                    }
                  : picking
                    ? pickAnswer
                    : undefined
              }
              pickable={pickable}
              onOpenLocation={showLocation}
            />
          )}
          {detailTarget?.row === 'map' && (
            <MapStrip board={board} to="investigators" onGo={detail.go} />
          )}
        </section>
        <section id="investigators" aria-labelledby="investigators-title">
          <h2 id="investigators-title">{t('investigators.title')}</h2>
          <InvestigatorBar
            board={board}
            actions={store.getState().actions}
            busy={open.busy}
            adjusting={open.adjusting}
            onOpen={
              showDetail && detailTarget?.row !== 'investigators'
                ? (investigator) => showDetail({ row: 'investigators', investigator })
                : undefined
            }
            whole={detailTarget?.row === 'investigators'}
            printed={
              cards.status === 'ready'
                ? (code) => printedInvestigatorOf(cards.catalog, code)
                : undefined
            }
          />
        </section>
        {detailTarget && (
          <DetailControls board={boardElement} target={detailTarget} onClose={detail.close} />
        )}
        {/* Adjusting the board is allowed with a decision open, so the dialog steps aside meanwhile. */}
        {decision && !open.adjusting && !hosted && (
          <DecisionDialog
            key={open.state.pending[0]?.id}
            board={board}
            decision={decision}
            actions={store.getState().actions}
            busy={open.busy}
            picking={picking}
            onPicking={(to) => setPickingFor(to ? decisionId : undefined)}
          />
        )}
        <ResolutionPrompt key={open.gameId} store={store} open={open} />
        <div id="notices">
          {open.log && <ChangesNotice key={open.gameId} log={open.log} state={open.state} />}
          {open.spawning && (
            <SpawnPrompt enemy={open.spawning} onCancel={() => store.getState().cancelSpawn()} />
          )}
          {open.drawnCards && (
            <DrawnCardsNotice
              board={board}
              drawn={open.drawnCards}
              actions={store.getState().actions}
              busy={open.busy}
              onSpawn={(enemy) => store.getState().startSpawn(enemy)}
              onDismiss={() => store.getState().dismissNotice('drawnCards')}
            />
          )}
          {open.skippedEffects && (
            <SkippedEffectsNotice
              skipped={open.skippedEffects}
              onDismiss={() => store.getState().dismissNotice('skippedEffects')}
            />
          )}
          {open.rejection && (
            <RejectionToast
              rejection={open.rejection}
              onDismiss={() => store.getState().dismissRejection()}
            />
          )}
        </div>
      </div>
    </DecisionHostContext.Provider>
  );
}
