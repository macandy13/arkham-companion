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
import { DetailControls } from './DetailControls';
import { GameHeader, printedReferenceOf } from './GameHeader';
import { printedInvestigatorOf } from '../investigators/InvestigatorFace';
import { GameStatus } from './GameStatus';
import { MapStrip } from './MapStrip';
import { RejectionToast } from './RejectionToast';
import { DrawnCardsNotice } from '../encounter/DrawnCardsNotice';
import { ResolutionPrompt } from '../campaign/ResolutionPrompt';
import { SpawnPrompt } from '../encounter/SpawnPrompt';
import { SkippedEffectsNotice } from './SkippedEffectsNotice';
import { useDetailView } from './useDetailView';
import { usePhone } from './usePhone';
import './game.css';

/**
 * Route `/game/:id`: loads the game named in the URL (so deep links and reloads work)
 * and shows the board layout of product.md "UI concept": the header, the status row, the map, the investigator bar,
 * the first open decision as a dialog, the reason when an action is refused, and the card effects it skipped. Until the game is open it says so, and
 * a game it cannot play (its scenario is not in the catalog) gets a warning instead of a board.
 *
 * On a phone held upright the board starts as the compact view (the stylesheet's phone blocks); a
 * tap on a header card, the map's expand button or the investigator's name opens the detail view
 * on it (`useDetailView`, `data-view="detail"`), the same parts laid out as rows to swipe between
 * (`DetailControls`); the map row gets a strip above and below the map (`MapStrip`). A tap on a
 * location there or in the compact view shows that location in the map row (`LocationFocus`), the
 * location mode, until the players go back to the map; while they choose where an enemy spawns,
 * or pick the answer to the open decision on the map (`DecisionView.locations`), the map shows,
 * its pickable locations lit. Picking belongs to the decision it was started for, so the next
 * one opens raised; a tap on a location the decision cannot pick raises the dialog again. The scenario card's texts come from the card `catalog`.
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
  const boardElement = useRef<HTMLDivElement>(null);
  const detailTarget = phone ? detail.target : undefined;
  const opensDetail = phone && !detailTarget;

  useEffect(() => {
    void store.getState().openGame(gameId);
  }, [store, gameId]);

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
  const showLocation = phone
    ? (location: InstanceId) => (detailTarget ? detail.go : detail.open)({ row: 'map', location })
    : undefined;

  return (
    <div
      id="board"
      ref={boardElement}
      data-view={detailTarget ? 'detail' : undefined}
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
        onOpenCard={opensDetail ? (card) => detail.open({ row: 'cards', card }) : undefined}
        full={detailTarget !== undefined}
      />
      <GameStatus store={store} open={open} board={board} />
      <section id="map" aria-labelledby="map-title">
        <h2 id="map-title">{t('map.title')}</h2>
        {opensDetail && (
          <button
            type="button"
            data-icon="expand"
            data-detail="expand"
            aria-label={t('detail.openMap')}
            onClick={() => detail.open({ row: 'map' })}
          />
        )}
        {detailTarget && <MapStrip board={board} to="cards" onGo={detail.go} />}
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
        {detailTarget && <MapStrip board={board} to="investigators" onGo={detail.go} />}
      </section>
      <section id="investigators" aria-labelledby="investigators-title">
        <h2 id="investigators-title">{t('investigators.title')}</h2>
        <InvestigatorBar
          board={board}
          actions={store.getState().actions}
          busy={open.busy}
          adjusting={open.adjusting}
          onOpen={
            opensDetail
              ? (investigator) => detail.open({ row: 'investigators', investigator })
              : undefined
          }
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
      {decision && !open.adjusting && (
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
            onDismiss={() => store.getState().dismissDrawnCards()}
          />
        )}
        {open.skippedEffects && (
          <SkippedEffectsNotice
            skipped={open.skippedEffects}
            onDismiss={() => store.getState().dismissSkippedEffects()}
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
  );
}
