import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { assertNever } from '@arkham/util';
import type { BoardView, InvestigatorId, LocationView } from '@arkham/engine';
import { DetailsDialog, useDecisionHost } from '../screens/DetailsDialog';
import { AttachedCards } from '../screens/AttachedCards';
import {
  ActionButton,
  ActionGroup,
  CardActions,
  cardActionsOn,
  type ActionIcon,
} from '../screens/ActionRow';
import { SplitAction } from '../screens/SplitAction';
import type { GameActions } from '../state/gameActions';
import { CardPatterns } from './CardPatterns';
import { LocationTile } from './LocationTile';
import { TILE } from './mapLayout';
import { takeOneClue } from '../state/gameActions';
import { usePlay } from '../screens/PlayContext';

/**
 * One location in full, opened by a tap on its tile or its details button on a tablet or wider,
 * on the card shell (`DetailsDialog`): the location drawn as its card beside the page, the same
 * drawing as its tile with the pieces on it (`LocationCard`), its name as the title, its shroud
 * and the clues left of its clue value for the player count (`LocationValues`), and the page's
 * parts (`LocationPage`). Escape and its × close it. A move closes it, since the players look
 * elsewhere then; an investigation keeps it open and shows its test's decision in place of the
 * page (`useDecisionHost`), with the location still beside it.
 */
export function LocationDetails({
  board,
  location,
  onClose,
}: {
  board: BoardView;
  location: LocationView;
  onClose: () => void;
}) {
  const hosted = useDecisionHost();
  return (
    <DetailsDialog
      board={board}
      hosted={hosted}
      name="location"
      card={board.cardFace(location.id)}
      drawn={<LocationCard board={board} location={location} />}
      title={location.name}
      onClose={onClose}
    >
      <LocationValues location={location} />
      <LocationPage board={board} location={location} onLeave={onClose} onTest={hosted.host} />
    </DetailsDialog>
  );
}

/**
 * A location's values on the details' page: its shroud and the clues left of its clue value for
 * the player count (`LocationView.clueValue`) once revealed; only that it is unrevealed before.
 */
function LocationValues({ location }: { location: LocationView }) {
  const { t } = useTranslation();
  if (!location.revealed) return <p>{t('location.unrevealed')}</p>;
  return (
    <dl>
      <div>
        <dt>{t('location.shroud')}</dt>
        <dd>{location.shroud}</dd>
      </div>
      <div>
        <dt>{t('location.cluesLeft')}</dt>
        <dd>{t('location.cluesOf', { left: location.clues, value: location.clueValue })}</dd>
      </div>
    </dl>
  );
}

/**
 * What the players see of one location in the phone's location mode (`LocationFocus`): its name
 * as a heading (`titleId`), its card, drawn like its tile with the pieces on it, its shroud and
 * clues, and the parts the details' page shows too (`LocationPage`). The location mode sets its
 * neighbours around the card (`around`).
 */
export function LocationContent({
  board,
  location,
  titleId,
  around,
  onLeave,
}: {
  board: BoardView;
  location: LocationView;
  titleId: string;
  around?: (card: ReactNode) => ReactNode;
  onLeave?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <h2 id={titleId}>{location.name}</h2>
      {around ? (
        around(<LocationCard board={board} location={location} />)
      ) : (
        <LocationCard board={board} location={location} />
      )}
      <p>
        {location.revealed
          ? t('location.facts', { shroud: location.shroud, clues: location.clues })
          : t('location.unrevealed')}
      </p>
      <LocationPage board={board} location={location} {...(onLeave ? { onLeave } : {})} />
    </>
  );
}

/**
 * The parts of a location both the details and the location mode show: who is there
 * (investigators and enemies), the cards attached to it, with Discard and Attach a card
 * (`AttachedCards`), and under them one row of what the
 * investigator whose turn it is can do there (`locationActions`) and the actions the location's
 * card offers them (`CardActions`, such as the Parlor's Resign), and Reveal for an unrevealed one,
 * as a card can tell the players to (its clues and doom change in its tile's − / + bubble,
 * `LocationBubble`). It reads the location fresh
 * from the board, so its counts follow each step. A move, an investigation or a card action calls
 * `onLeave` first, for a view that should step aside then, except that an investigation calls
 * `onTest` instead when given, for a view that shows the test itself; Reveal and a clue taken
 * do neither, since those often come several at a time. Nothing is tapped while a step is queued (`usePlay().busy`).
 */
function LocationPage({
  board,
  location,
  onLeave,
  onTest,
}: {
  board: BoardView;
  location: LocationView;
  onLeave?: () => void;
  onTest?: () => void;
}) {
  const { actions, busy } = usePlay();
  const { t } = useTranslation();
  const offered = locationActions(board, location, actions);
  const printed = cardActionsOn(board, location.id);
  const revealable = !location.revealed;
  const leaveFor = (then: LocationAction['then']) => {
    switch (then) {
      case 'test':
        (onTest ?? onLeave)?.();
        break;
      case 'leave':
        onLeave?.();
        break;
      case 'stay':
        break;
      default:
        assertNever(then);
    }
  };
  const wayOf = ({ key, cost, then }: LocationAction, play: () => Promise<void>) => ({
    key,
    actions: cost,
    name: t(`location.${key}`, { count: cost }),
    onPick: () => {
      leaveFor(then);
      void play();
    },
  });
  const button = (action: LocationAction) => (
    <ActionButton
      key={action.key}
      icon={action.icon}
      actions={action.cost}
      caption={t(`location.caption.${action.icon}`)}
      name={t(`location.${action.key}`, { count: action.cost })}
      disabled={busy || action.play === undefined}
      onClick={() => {
        leaveFor(action.then);
        void action.play?.();
      }}
    />
  );
  const investigateHere = offered.find(({ key }) => key === 'investigateAction');
  const byCard = location.revealed && !location.forbidden?.includes('investigate');
  const investigateWays = byCard
    ? board.investigatorsInPlay.map(({ id, name }) => ({
        key: id,
        name: t('byCard.testBy', { test: t('byCard.investigate'), name }),
        onPick: () => {
          leaveFor('test');
          void actions.investigate(location.id, { byCard: id });
        },
      }))
    : [];
  const investigate =
    investigateHere?.play === undefined && investigateHere !== undefined ? (
      button(investigateHere)
    ) : (
      <SplitAction
        key="investigate"
        icon="investigate"
        caption={t('location.caption.investigate')}
        waysName={t('ways.investigate')}
        {...(investigateHere?.play === undefined
          ? {}
          : { primary: wayOf(investigateHere, investigateHere.play) })}
        ways={investigateWays}
        disabled={busy}
      />
    );
  const moveAction = offered.find(({ key }) => key === 'moveAction');
  const moveFree = offered.find(({ key }) => key === 'moveFree');
  const pills = [
    ...(investigateHere !== undefined || investigateWays.length > 0 ? [investigate] : []),
    ...offered.filter(({ key }) => key === 'takeClue').map(button),
    ...(moveAction?.play === undefined
      ? []
      : [
          <SplitAction
            key="move"
            icon="move"
            caption={t('location.caption.move')}
            waysName={t('ways.move')}
            primary={wayOf(moveAction, moveAction.play)}
            ways={moveFree?.play === undefined ? [] : [wayOf(moveFree, moveFree.play)]}
            disabled={busy}
          />,
        ]),
  ];

  return (
    <>
      <Here board={board} location={location} />
      <AttachedCards board={board} host={location.id} />
      <footer>
        {pills.length > 0 && <ActionGroup title={t('location.actions')}>{pills}</ActionGroup>}
        {printed.length > 0 && <CardActions board={board} offered={printed} onUse={onLeave} />}
        {revealable && (
          <ActionGroup title={t('location.corrections')}>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void actions.perform({ type: 'RevealLocation', locationId: location.id })
              }
            >
              {t('location.reveal')}
            </button>
          </ActionGroup>
        )}
      </footer>
    </>
  );
}

/**
 * One button of the location details' action row: its name and caption keys (`location.<key>`,
 * `location.caption.<icon>`), the actions it counts off (`cost`, 0 for none, which a name with
 * plural forms says, as a raised cost can make it more), and the step it plays; without
 * `play` it shows but is off, as a clue at a location that has none. `then` says what the view
 * does first: step aside (`leave`), as after a move the location is no longer where the players
 * look, show the test the step starts (`test`), or nothing (`stay`).
 */
interface LocationAction {
  key: 'investigateAction' | 'takeClue' | 'moveAction' | 'moveFree';
  icon: Extract<ActionIcon, 'investigate' | 'clue' | 'move'>;
  cost: number;
  play?: () => Promise<void>;
  then: 'leave' | 'test' | 'stay';
}

/**
 * What the investigator whose turn it is can do at `location`: at their own location investigate
 * as an action, or take a clue without a test, as cards grant it; at a location connected to
 * theirs (`BoardView.connectedTo`) move there as an action, which provokes attacks of
 * opportunity, or free, as a card allows. What a card forbids there (`LocationView.forbidden`) is
 * off (investigate) or left out (move), and so is taking a clue while a card forbids the
 * investigator to discover clues (`InvestigatorView.forbidden`, The Masked Hunter). A list rather than fixed buttons, since the cards
 * attached to a location will add their own abilities to it; the ones that count off an action come first, as the enemy details list them. Nothing between turns.
 */
function locationActions(
  board: BoardView,
  location: LocationView,
  actions: GameActions,
): LocationAction[] {
  const turn = board.turn;
  if (turn === undefined) return [];
  const cannotDiscover = board.investigator(turn).forbidden?.clues?.includes('discover') === true;
  if (location.investigators?.includes(turn))
    return [
      {
        key: 'investigateAction',
        icon: 'investigate',
        cost: board.actionCost(turn, 'investigate'),
        play: location.forbidden?.includes('investigate') ? undefined : () => actions.investigate(),
        then: 'test',
      },
      {
        key: 'takeClue',
        icon: 'clue',
        cost: 0,
        play:
          location.clues > 0 && !cannotDiscover
            ? () => actions.perform(takeOneClue(location.id, turn))
            : undefined,
        then: 'stay',
      },
    ];
  const from = board.locationOf(turn);
  if (from === undefined || !board.connectedTo(from).includes(location.id)) return [];
  if (location.forbidden?.includes('moveInto')) return [];
  return [
    {
      key: 'moveAction',
      icon: 'move',
      cost: board.actionCost(turn, 'move'),
      play: () => actions.move(location.id),
      then: 'leave',
    },
    {
      key: 'moveFree',
      icon: 'move',
      cost: board.actionCost(turn, 'move', { free: true }),
      play: () => actions.move(location.id, 'free'),
      then: 'leave',
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
        enemies={board.enemiesAt(location.id)}
        investigators={board.investigatorsAt(location.id)}
        turnOrder={board}
        dragOf={() => undefined}
        x={0}
        y={0}
      />
    </svg>
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
  const enemies = board.enemiesAt(location.id);
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
