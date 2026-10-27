import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView, CardFaceView, InvestigatorId, LocationView } from '@arkham/engine';
import { CardZoom } from '../screens/CardZoom';
import {
  ActionButton,
  ActionGroup,
  CardActions,
  cardActionsOn,
  type ActionIcon,
} from '../screens/ActionRow';
import type { ActionCost, GameActions, LocationToken } from '../state/gameActions';
import { CardPatterns, LocationTile } from './LocationTile';
import { TILE } from './mapLayout';

/**
 * One location in full, opened by a tap on its tile or its details button: its card, drawn like
 * its tile with the pieces on it, its shroud and clues, who is there (investigators and enemies),
 * the cards attached to it, and under it one row of what the investigator whose
 * turn it is can do there (`locationActions`) and the actions the location's card offers them
 * (`CardActions`, such as the Parlor's Resign). While the players adjust the board (`adjusting`),
 * the row gives way to the corrections instead: reveal it and add or remove its clues and doom,
 * as a card effect or the table asks, so the screen keeps up with the physical game; they are not
 * steps of play, so the two never show together. It reads the location fresh from the board, so
 * its counts follow each step, and stays open across corrections and a clue taken, since those
 * often come several at a time; a move or an investigation closes it, so the decision dialog
 * that may follow is the only one open. A native modal `<dialog>` brings focus trapping and
 * Escape; nothing is tapped while a step is queued (`busy`).
 */
export function LocationDetails({
  board,
  location,
  actions,
  busy,
  adjusting,
  onClose,
}: {
  board: BoardView;
  location: LocationView;
  actions: GameActions;
  busy: boolean;
  adjusting: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const offered = adjusting ? [] : locationActions(board, location, actions);
  const printed = adjusting ? [] : cardActionsOn(board, location.id);
  const button = ({ key, icon, cost, play, closes }: LocationAction) => (
    <ActionButton
      key={key}
      icon={icon}
      cost={cost === 'action' ? 'action' : undefined}
      caption={t(`location.caption.${icon}`)}
      name={t(`location.${key}`)}
      disabled={busy || play === undefined}
      onClick={() => {
        if (closes) onClose();
        void play?.();
      }}
    />
  );
  const asAction = offered.filter(({ cost }) => cost === 'action');
  const free = offered.filter(({ cost }) => cost === 'free');

  return (
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={onClose} data-dialog="location">
      <button type="button" data-icon="close" aria-label={t('location.close')} onClick={onClose} />
      <h2 id={titleId}>{location.name}</h2>
      <LocationCard board={board} location={location} />
      <p>
        {location.revealed
          ? t('location.facts', { shroud: location.shroud, clues: location.clues })
          : t('location.unrevealed')}
      </p>
      <Here board={board} location={location} />
      {location.attachments && (
        <Attached cards={board.cardsIn({ kind: 'attachedTo', hostId: location.id })} />
      )}
      {adjusting && <Corrections location={location} actions={actions} busy={busy} />}
      {offered.length + printed.length > 0 && (
        <footer>
          {asAction.length > 0 && (
            <ActionGroup title={t('location.asAction')}>{asAction.map(button)}</ActionGroup>
          )}
          {free.length > 0 && (
            <ActionGroup title={t('location.free')}>{free.map(button)}</ActionGroup>
          )}
          {printed.length > 0 && (
            <CardActions offered={printed} actions={actions} busy={busy} onUse={onClose} />
          )}
        </footer>
      )}
    </dialog>
  );
}

/**
 * One button of the location details' action row: its name and caption keys (`location.<key>`,
 * `location.caption.<icon>`), whether it counts off an action, and the step it plays; without
 * `play` it shows but is off, as a clue at a location that has none. `closes` closes the window
 * first, for a step after which the location is no longer where the players look.
 */
interface LocationAction {
  key: 'investigateAction' | 'takeClue' | 'moveAction' | 'moveFree';
  icon: Extract<ActionIcon, 'investigate' | 'clue' | 'move'>;
  cost: ActionCost;
  play?: () => Promise<void>;
  closes: boolean;
}

/**
 * What the investigator whose turn it is can do at `location`: at their own location investigate
 * as an action, or take a clue without a test, as cards grant it; at a location connected to
 * theirs (`BoardView.connectedTo`) move there as an action, which provokes attacks of
 * opportunity, or free, as a card allows. What a card forbids there (`LocationView.forbidden`) is
 * off (investigate) or left out (move), and so is taking a clue while a card forbids the
 * investigator to discover clues (`InvestigatorView.forbidden`, The Masked Hunter). A list rather than fixed buttons, since the cards
 * attached to a location will add their own abilities to it. Nothing between turns.
 */
function locationActions(
  board: BoardView,
  location: LocationView,
  actions: GameActions,
): LocationAction[] {
  const turn = board.turn;
  if (turn === undefined) return [];
  const cannotDiscover = board.investigator(turn).forbidden?.includes('discoverClues') === true;
  if (location.investigators?.includes(turn))
    return [
      {
        key: 'investigateAction',
        icon: 'investigate',
        cost: 'action',
        play: location.forbidden?.includes('investigate') ? undefined : () => actions.investigate(),
        closes: true,
      },
      {
        key: 'takeClue',
        icon: 'clue',
        cost: 'free',
        play:
          location.clues > 0 && !cannotDiscover ? () => actions.takeClue(location.id) : undefined,
        closes: false,
      },
    ];
  const from = board.locationOf(turn);
  if (from === undefined || !board.connectedTo(from).includes(location.id)) return [];
  if (location.forbidden?.includes('moveInto')) return [];
  return [
    {
      key: 'moveAction',
      icon: 'move',
      cost: 'action',
      play: () => actions.moveTo(location.id, 'action'),
      closes: true,
    },
    {
      key: 'moveFree',
      icon: 'move',
      cost: 'free',
      play: () => actions.moveTo(location.id, 'free'),
      closes: true,
    },
  ];
}

/**
 * The location drawn as its card, the same drawing as its tile on the map (with its pieces, but
 * no details button), at the size of a zoomed card. It is one image to assistive technology,
 * since the text around it says what it shows.
 */
function LocationCard({ board, location }: { board: BoardView; location: LocationView }) {
  const { t } = useTranslation();
  const map = board.maps.find(({ id }) => id === location.map);
  return (
    <svg
      role="img"
      aria-label={t('location.card', { name: location.name })}
      viewBox={`0 0 ${TILE.width} ${TILE.height}`}
    >
      <defs>
        <CardPatterns />
      </defs>
      <LocationTile
        location={location}
        enemies={map?.enemies[location.id] ?? []}
        investigators={board.investigatorsAt(location.id)}
        turnOrder={board}
        dragOf={() => undefined}
        x={0}
        y={0}
      />
    </svg>
  );
}

/** The cards attached to the location, such as a treachery put into play there, each opening large to read (`CardZoom`). */
function Attached({ cards }: { cards: readonly CardFaceView[] }) {
  const { t } = useTranslation();
  const titleId = useId();
  const [zoomed, setZoomed] = useState<CardFaceView>();
  return (
    <section aria-labelledby={titleId}>
      <h3 id={titleId}>{t('location.attached')}</h3>
      <ul>
        {cards.map((card, i) => (
          <li key={`${card.name}-${i}`}>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-label={t('cardZoom.open', { name: card.name })}
              onClick={() => setZoomed(card)}
            >
              {card.name}
            </button>
          </li>
        ))}
      </ul>
      {zoomed && <CardZoom card={zoomed} onClose={() => setZoomed(undefined)} />}
    </section>
  );
}

/**
 * Who is at the location: its investigators, then its enemies, each enemy with whom it is
 * engaged; a line saying no one is there otherwise.
 */
function Here({ board, location }: { board: BoardView; location: LocationView }) {
  const { t } = useTranslation();
  const titleId = useId();
  const investigators = board.investigatorsAt(location.id);
  const enemies = board.maps.find(({ id }) => id === location.map)?.enemies[location.id] ?? [];
  const nameOf = (id: InvestigatorId) => board.investigator(id).name;
  return (
    <section aria-labelledby={titleId}>
      <h3 id={titleId}>{t('location.here')}</h3>
      {investigators.length + enemies.length === 0 ? (
        <p>{t('location.nobody')}</p>
      ) : (
        <ul>
          {investigators.map(({ id, name }) => (
            <li key={id}>{name}</li>
          ))}
          {enemies.map(({ id, name, engagedWith }) => (
            <li key={id}>
              {engagedWith === undefined
                ? name
                : t('location.engagedWith', { enemy: name, investigator: nameOf(engagedWith) })}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The corrections while adjusting: reveal the location, and its clue and doom steppers. */
function Corrections({
  location,
  actions,
  busy,
}: {
  location: LocationView;
  actions: GameActions;
  busy: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section aria-label={t('location.corrections')}>
      {!location.revealed && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void actions.revealLocation(location.id)}
        >
          {t('location.reveal')}
        </button>
      )}
      <TokenStepper
        token="clue"
        count={location.clues}
        onStep={(delta) => void actions.adjustLocation(location.id, 'clue', delta)}
        busy={busy}
      />
      <TokenStepper
        token="doom"
        count={location.doom ?? 0}
        onStep={(delta) => void actions.adjustLocation(location.id, 'doom', delta)}
        busy={busy}
      />
    </section>
  );
}

/** The count of one token on the location with − and + buttons; − is off at none. */
function TokenStepper({
  token,
  count,
  onStep,
  busy,
}: {
  token: LocationToken;
  count: number;
  onStep: (delta: number) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section aria-label={t(`location.${token}.label`)}>
      <p>{t(`location.${token}.count`, { count })}</p>
      <button
        type="button"
        aria-label={t(`location.${token}.remove`)}
        disabled={busy || count === 0}
        onClick={() => onStep(-1)}
      >
        −
      </button>
      <button
        type="button"
        aria-label={t(`location.${token}.add`)}
        disabled={busy}
        onClick={() => onStep(1)}
      >
        +
      </button>
    </section>
  );
}
