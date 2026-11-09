import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SKILL_NAMES,
  type BoardView,
  type InvestigatorCode,
  type InvestigatorId,
  type InvestigatorView,
  type MapEnemyView,
  type SkillName,
} from '@arkham/engine';
import { Brain, Heart } from '../catalog/cardFace';
import { range } from '@arkham/util';
import { useCardPicture } from '../catalog/cardImages';
import type { GameActions, SteppedStat } from '../state/gameActions';
import { classOf, type PrintedInvestigator } from '@arkham/carddata';
import { InvestigatorFace, type InvestigatorFaceShape } from './InvestigatorFace';
import { SkillTestDialog } from './SkillTestDialog';
import { signed } from './TestCalculation';
import { PlayArea } from './PlayArea';
import { ThreatArea } from './ThreatArea';
import { TurnControls } from './TurnControls';
import { InvestigatorCard, WholeCard } from './InvestigatorCard';
import { deltaText, useCountChange } from '../screens/countChange';
import type { TokenDragHandlers } from '../screens/useTokenDrag';
import { useReturnToPool } from '../screens/useReturnToPool';
import { GameToken, type GameTokenKind } from '../tokens/GameToken';
import { PipRing } from './PipRing';
import { useClueDrag } from './useClueDrag';
import { CounterBubble, type BubbleSide } from '../screens/CounterBubble';
import { useDoubleTap } from '../screens/useDoubleTap';
import './investigators.css';

/**
 * The bar of investigator panels along the foot of the play screen, one per investigator in seat
 * order (`BoardView.investigators`), so everyone's status is in view at once. It replaces the
 * health and sanity dials and the clue and resource piles on the table: each change is a tap on a
 * stepper, which plays `actions`; nothing is tapped while a step is queued (`busy`). The steppers
 * show only while the players adjust the board (`adjusting`, `OpenGame.adjusting`), and the turn
 * controls wait meanwhile, since a turn step is play, not a correction.
 *
 * A phone has room for one panel only, so in its compact view (`onOpen`) the stylesheet lays the
 * panels in a row a screen wide each, and the players swipe sideways between them; the one in
 * view is the focused one (`data-focus`, `useSwipedTo`), and dots on each panel show its seat in
 * the row. Focus follows the turn, see `useFocus`,
 * and the row scrolls to it. There the focused investigator's name is a button that opens the
 * detail view on their panel, and the card is the slim strip (`InvestigatorFace`) to leave the map
 * room.
 * Expanded in place there (`whole`), each panel shows the whole card (`WholeCard`) instead.
 */
export function InvestigatorBar({
  board,
  actions,
  busy,
  adjusting,
  onOpen,
  whole = false,
  printed,
}: {
  board: BoardView;
  actions: GameActions;
  busy: boolean;
  adjusting: boolean;
  onOpen?: ((investigator: InvestigatorId) => void) | undefined;
  /** The phone's expanded bar: every panel shows the whole card, its text included. */
  whole?: boolean;
  /** Looks up what each investigator's card prints (`printedInvestigatorOf`), once the catalog has loaded. */
  printed?: ((code: InvestigatorCode) => PrintedInvestigator | undefined) | undefined;
}) {
  // The players pick who goes next in the investigation phase, once no turn is in progress.
  const picking = board.phase === 'investigation' && board.turn === undefined;
  const [focus, setFocus] = useFocus(board);
  return (
    <>
      {board.investigators.map((investigator, seat) => (
        <InvestigatorPanel
          key={investigator.id}
          seat={
            onOpen && board.investigators.length > 1
              ? { at: seat, of: board.investigators.length }
              : undefined
          }
          board={board}
          investigator={investigator}
          printed={printed?.(investigator.code)}
          focused={focus === investigator.id}
          onShown={onOpen ? () => setFocus(investigator.id) : undefined}
          onOpen={focus === investigator.id ? onOpen : undefined}
          shape={onOpen ? 'strip' : 'banner'}
          whole={whole}
          onTurn={board.turn === investigator.id}
          lead={board.lead === investigator.id}
          engaged={board.enemiesEngagedWith(investigator.id)}
          canStart={
            picking && investigator.status === 'active' && investigator.turnTaken === undefined
          }
          actions={actions}
          busy={busy}
          adjusting={adjusting}
        />
      ))}
    </>
  );
}

/**
 * The investigator the phone shows in full: the one the players tapped last, until the turn
 * changes, else the one whose turn it is, else the lead investigator (the first one once nobody
 * leads, as everyone has left the game). A tap is kept with the round, phase and turn it was made
 * in (`turnKey`), so a new turn brings its investigator to the front without an effect, even when
 * the same investigator's turn comes round again.
 */
function useFocus(board: BoardView): [InvestigatorId | undefined, (id: InvestigatorId) => void] {
  const [picked, setPicked] = useState<{ id: InvestigatorId; turn: string }>();
  const focus =
    picked && picked.turn === turnKey(board)
      ? picked.id
      : (board.turn ?? board.lead ?? board.investigators[0]?.id);
  return [focus, (id) => setPicked({ id, turn: turnKey(board) })];
}

/**
 * The phone's row of panels, one a screen wide, which the players swipe between: once a panel is
 * mostly in view (`SHOWN_SHARE`) it tells `onShown`, which focuses it, and a panel focused
 * otherwise (the turn moved on) scrolls into view at once, so the row passes no panel between on
 * its way, which would take the focus. Without `onShown` (a wider screen, or the phone's expanded
 * bar, whose dots follow the row themselves) it does nothing. Returns the panel's ref.
 */
function useSwipedTo(focused: boolean, onShown: (() => void) | undefined) {
  const section = useRef<HTMLElement>(null);
  const shown = useRef(onShown);
  const carousel = onShown !== undefined;
  useLayoutEffect(() => {
    shown.current = onShown;
  });
  useLayoutEffect(() => {
    if (carousel && focused)
      section.current?.scrollIntoView?.({ block: 'nearest', inline: 'start', behavior: 'instant' });
  }, [carousel, focused]);
  const focusedNow = useRef(focused);
  useLayoutEffect(() => {
    focusedNow.current = focused;
  });
  useEffect(() => {
    const panel = section.current;
    const row = panel?.parentElement;
    // jsdom has no IntersectionObserver; without one the row only follows the turn.
    if (!carousel || !panel || !row || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !focusedNow.current) shown.current?.();
      },
      { root: row, threshold: SHOWN_SHARE },
    );
    observer.observe(panel);
    return () => observer.disconnect();
  }, [carousel]);
  return section;
}

/** How much of a panel must be in view on the phone's row for it to take the focus. */
const SHOWN_SHARE = 0.6;

/** Names the turn in progress, or the time between turns, uniquely within a game (`useFocus`). */
function turnKey(board: BoardView): string {
  return `${board.round}:${board.phase}:${board.turn ?? ''}`;
}

/**
 * One investigator: their threat area along the top edge of their card, the card drawn as the top
 * of the printed one (`InvestigatorFace`) with the name and subname on its plates, the four skills
 * on their chain and the counters on a strip of its notebook page. The players hold the card
 * itself, so its abilities and flavour stay off the screen to leave the board its room; a tap on
 * the art shows the whole card with its text (`InvestigatorCard`). Then where they are and how their round goes, the
 * cards they control (`PlayArea`) and their turn controls. Before where they are, a pentagon marks
 * the lead investigator, like the game's lead investigator token; whose turn it is needs no
 * marker, since only their turn controls carry the action arrows. Health and sanity show what is left of the printed value, like
 * the dials, while their steppers place and heal damage and horror, like the tokens on the card.
 * Clues show without steppers: they
 * are found by investigating and spent on the act.
 */
function InvestigatorPanel({
  board,
  investigator,
  printed,
  seat,
  focused,
  onShown,
  onOpen,
  shape,
  whole,
  onTurn,
  lead,
  engaged,
  canStart,
  actions,
  busy,
  adjusting,
}: {
  /** The board the skill tests (`SkillTestDialog`) and the card actions (`TurnControls`) read. */
  board: BoardView;
  investigator: InvestigatorView;
  /** What their card prints besides its stats: the subname and class, once the catalog has them. */
  printed: PrintedInvestigator | undefined;
  /**
   * Where the panel sits on the phone's row of panels, which its dots show, so the players see
   * there is more to swipe to; nothing elsewhere, or in a solo game.
   */
  seat: { at: number; of: number } | undefined;
  /** The phone shows this panel in full (`useFocus`). */
  focused: boolean;
  /** The players swiped this panel into view, on the phone's row of panels (`useSwipedTo`). */
  onShown: (() => void) | undefined;
  /** Opens the phone's detail view on this panel, from a tap on the name. */
  onOpen: ((investigator: InvestigatorId) => void) | undefined;
  /** The card's shape: the phone's compact view has room for the slim strip only. */
  shape: InvestigatorFaceShape;
  /** The whole card shows in place of the compact one, with nothing left to open from its art. */
  whole: boolean;
  onTurn: boolean;
  /** They are the lead investigator (`BoardView.lead`). */
  lead: boolean;
  /** The enemies engaged with the investigator, shown in their threat area. */
  engaged: readonly MapEnemyView[];
  /** The players may start this investigator's turn now (`TurnControls`). */
  canStart: boolean;
  actions: GameActions;
  busy: boolean;
  adjusting: boolean;
}) {
  const { t } = useTranslation();
  const nameId = useId();
  const picture = useCardPicture(investigator.image, 'landscape');
  const [zoomed, setZoomed] = useState(false);
  const section = useSwipedTo(focused, onShown);
  const stats = (
    <>
      <Skills
        board={board}
        investigator={investigator}
        adjusting={adjusting}
        busy={busy}
        actions={actions}
      />
      <Counters
        board={board}
        investigator={investigator}
        adjusting={adjusting}
        busy={busy}
        actions={actions}
      />
    </>
  );
  return (
    <section
      ref={section}
      aria-labelledby={nameId}
      data-status={investigator.status}
      data-turn={onTurn || undefined}
      data-focus={focused || undefined}
      data-investigator={investigator.id}
    >
      {seat && (
        <ol aria-hidden="true" data-dots="investigators">
          {range(seat.of).map((other) => (
            <li key={other} data-current={other === seat.at || undefined} />
          ))}
        </ol>
      )}
      <ThreatArea
        board={board}
        investigator={investigator}
        treacheries={board.cardsIn({ kind: 'threatArea', investigatorId: investigator.id })}
        enemies={engaged}
        actions={actions}
        // Fighting and evading are play, so they wait while the players adjust, like the turn's.
        busy={busy || adjusting}
      />
      {whole ? (
        <WholeCard
          investigator={investigator}
          printed={printed}
          picture={picture}
          nameId={nameId}
          adjusting={adjusting}
        >
          {stats}
        </WholeCard>
      ) : (
        <article
          data-card="investigator"
          data-picture={picture?.shown ? 'shown' : undefined}
          data-adjusting={adjusting || undefined}
          data-shape={shape}
        >
          <InvestigatorFace
            picture={picture}
            investigatorClass={classOf(printed?.factionCode)}
            shape={shape}
          />
          <button
            type="button"
            data-full-card=""
            aria-label={t('investigators.showCard', { name: investigator.name })}
            onClick={() => setZoomed(true)}
          />
          <header>
            <h3 id={nameId}>
              {onOpen ? (
                <button type="button" onClick={() => onOpen(investigator.id)}>
                  {investigator.name}
                </button>
              ) : (
                investigator.name
              )}
            </h3>
            {printed?.subname && <p>{printed.subname}</p>}
          </header>
          {stats}
        </article>
      )}
      {zoomed && (
        <InvestigatorCard
          investigator={investigator}
          printed={printed}
          picture={picture}
          onClose={() => setZoomed(false)}
        >
          <Skills
            board={board}
            investigator={investigator}
            adjusting={false}
            busy={busy}
            actions={actions}
          />
          <Counters
            board={board}
            investigator={investigator}
            adjusting={false}
            busy={busy}
            actions={actions}
          />
        </InvestigatorCard>
      )}
      <p data-whereabouts="">
        {lead && <span role="img" aria-label={t('investigators.lead')} data-marker="lead" />}
        <span>{statusLine(investigator, onTurn, t)}</span>
      </p>
      <PlayArea
        board={board}
        investigator={investigator}
        cards={board.cardsIn({ kind: 'playArea', investigatorId: investigator.id })}
        actions={actions}
        busy={busy || adjusting}
      />
      <TurnControls
        board={board}
        investigator={investigator}
        onTurn={onTurn}
        canStart={canStart}
        actions={actions}
        busy={busy || adjusting}
      />
    </section>
  );
}

/**
 * The four skills in the order the card prints them, each its value under its icon: the printed
 * value with its lasting boost (`InvestigatorView.boosts`, what player cards in play add), the
 * boost shown beside it, so the printed value stays recognisable. The icon alone does not say
 * which skill it is, so each one is named for screen readers. Tapping one opens a skill test
 * against it (`SkillTestDialog`), a calculator that changes nothing. While the players adjust the
 * board, a row under the card holds each skill's boost with its steppers, named by the skill's icon,
 * since two steppers are wider than a link on the chain; a step waits while one is queued (`busy`).
 */
function Skills({
  board,
  investigator,
  adjusting,
  busy,
  actions,
}: {
  board: BoardView;
  investigator: InvestigatorView;
  adjusting: boolean;
  busy: boolean;
  actions: GameActions;
}) {
  const { t } = useTranslation();
  const [testing, setTesting] = useState<SkillName>();
  const { boostedSkills, boosts } = investigator;
  // A defeated or resigned investigator has left the game, so their boosts no longer change.
  const off = busy || investigator.status !== 'active';
  return (
    <>
      <ul aria-label={t('investigators.skills')}>
        {SKILL_NAMES.map((skill) => {
          const boost = boosts?.[skill] ?? 0;
          const value = boostedSkills[skill];
          const name = t(`skill.${skill}`);
          return (
            <li key={skill} data-skill={skill}>
              <button
                type="button"
                aria-label={
                  boost === 0
                    ? t('investigators.skillValue', { skill: name, value })
                    : t('investigators.boostedSkillValue', {
                        skill: name,
                        value,
                        boost: signed(boost),
                      })
                }
                onClick={() => setTesting(skill)}
              >
                <data value={value}>{value}</data>
                {boost !== 0 && <data value={boost}>{signed(boost)}</data>}
              </button>
            </li>
          );
        })}
      </ul>
      {adjusting && (
        <dl aria-label={t('investigators.skillBoosts')} data-boosts="">
          {SKILL_NAMES.map((skill) => {
            const boost = boosts?.[skill] ?? 0;
            const name = t(`skill.${skill}`);
            return (
              <div key={skill} data-skill={skill}>
                <dt>{name}</dt>
                <dd>
                  <data value={boost}>{signed(boost)}</data>
                  <Steppers
                    lower={{ label: t('investigators.lowerBoost', { skill: name }), disabled: off }}
                    raise={{ label: t('investigators.raiseBoost', { skill: name }), disabled: off }}
                    onStep={(delta) => void actions.boostSkill(investigator.id, skill, delta)}
                  />
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      {testing && (
        <SkillTestDialog
          board={board}
          investigator={investigator}
          skill={testing}
          onClose={() => setTesting(undefined)}
        />
      )}
    </>
  );
}

/**
 * The counters on the card's notebook page, each a token like the ones on the table, with their
 * steppers while the players adjust the board (`adjusting`); a step plays `actions` unless one is
 * queued (`busy`). A clue can be dragged off the clue count onto their location or the act
 * (`useClueDrag`), and damage, horror or a resource back onto the header's token pool, which heals
 * or spends it (`useReturnToPool`). A double tap on a counter opens its − / + bubble
 * (`CounterBubble`, M6.9), whose steps are the steppers' own: by rule, so damage can defeat; a
 * clue goes to or comes from their location, as dragging it does, since the game's clues only
 * move between investigators and locations.
 */
function Counters({
  board,
  investigator,
  adjusting,
  busy,
  actions,
}: {
  /** The board a clue dragged off the card lands on (`useClueDrag`). */
  board: BoardView;
  investigator: InvestigatorView;
  adjusting: boolean;
  busy: boolean;
  actions: GameActions;
}) {
  const { t } = useTranslation();
  const { id, health, damage, sanity, horror } = investigator;
  const adjust = (stat: SteppedStat, delta: number) => void actions.adjust(id, stat, delta);
  // A defeated or resigned investigator has left the game, so their counters no longer change.
  const off = busy || investigator.status !== 'active';
  const clueDrag = useClueDrag(board, id, actions);
  const damageBack = useReturnToPool('damage', () => adjust('damage', -1));
  const horrorBack = useReturnToPool('horror', () => adjust('horror', -1));
  const resourceBack = useReturnToPool('resource', () => adjust('resources', -1));
  // Nothing comes off the card while the players adjust it with the steppers instead.
  const dragOff = (count: number, drag: TokenDragHandlers) =>
    off || adjusting || count === 0 ? undefined : drag;
  const [open, setOpen] = useState<{ kind: SteppedKind; anchor: Element }>();
  const at = board.locationOf(id);
  const cluesAt = at === undefined ? 0 : board.location(at).clues;
  const bubbles: Record<SteppedKind, Bubble> = {
    health: {
      label: t('investigators.health'),
      value: health - damage,
      lower: { label: t('investigators.takeDamage'), disabled: off },
      raise: { label: t('investigators.healDamage'), disabled: off || damage === 0 },
      onStep: (delta) => adjust('damage', -delta),
    },
    sanity: {
      label: t('investigators.sanity'),
      value: sanity - horror,
      lower: { label: t('investigators.takeHorror'), disabled: off },
      raise: { label: t('investigators.healHorror'), disabled: off || horror === 0 },
      onStep: (delta) => adjust('horror', -delta),
    },
    clues: {
      label: t('investigators.clues'),
      value: investigator.clues,
      lower: {
        label: t('investigators.placeClue'),
        disabled: off || at === undefined || investigator.clues === 0,
      },
      raise: { label: t('investigators.takeClue'), disabled: off || cluesAt === 0 },
      onStep: (delta) => void (delta < 0 ? actions.placeClue(id) : at && actions.takeClue(at, id)),
    },
    resources: {
      label: t('investigators.resources'),
      value: investigator.resources,
      lower: {
        label: t('investigators.spendResource'),
        disabled: off || investigator.resources === 0,
      },
      raise: { label: t('investigators.gainResource'), disabled: off },
      onStep: (delta) => adjust('resources', delta),
    },
  };
  // Not while the players adjust the board, whose steppers are out, nor once they left the game.
  const bubbleFor = (kind: SteppedKind) =>
    off || adjusting ? {} : { onDoubleTap: (anchor: Element) => setOpen({ kind, anchor }) };
  const shown = open && !off && !adjusting ? bubbles[open.kind] : undefined;
  return (
    <>
      <dl>
        <Stat
          kind="health"
          label={t('investigators.health')}
          value={health - damage}
          shown={t('investigators.left', { left: health - damage, max: health })}
          printed={{ max: health, taken: damage }}
          drag={dragOff(damage, damageBack.handlers)}
          {...bubbleFor('health')}
        >
          {adjusting && (
            <Steppers
              lower={{ label: t('investigators.takeDamage'), disabled: off }}
              raise={{ label: t('investigators.healDamage'), disabled: off || damage === 0 }}
              onStep={(delta) => adjust('damage', -delta)}
            />
          )}
        </Stat>
        <Stat
          kind="sanity"
          label={t('investigators.sanity')}
          value={sanity - horror}
          shown={t('investigators.left', { left: sanity - horror, max: sanity })}
          printed={{ max: sanity, taken: horror }}
          drag={dragOff(horror, horrorBack.handlers)}
          {...bubbleFor('sanity')}
        >
          {adjusting && (
            <Steppers
              lower={{ label: t('investigators.takeHorror'), disabled: off }}
              raise={{ label: t('investigators.healHorror'), disabled: off || horror === 0 }}
              onStep={(delta) => adjust('horror', -delta)}
            />
          )}
        </Stat>
        <Stat
          kind="clues"
          label={t('investigators.clues')}
          value={investigator.clues}
          drag={dragOff(investigator.clues, clueDrag.handlers)}
          {...bubbleFor('clues')}
        />
        <Stat
          kind="resources"
          label={t('investigators.resources')}
          short={t('investigators.resourcesShort')}
          value={investigator.resources}
          drag={dragOff(investigator.resources, resourceBack.handlers)}
          {...bubbleFor('resources')}
        >
          {adjusting && (
            <Steppers
              lower={{
                label: t('investigators.spendResource'),
                disabled: off || investigator.resources === 0,
              }}
              raise={{ label: t('investigators.gainResource'), disabled: off }}
              onStep={(delta) => adjust('resources', delta)}
            />
          )}
        </Stat>
        {investigator.doom !== undefined && (
          <Stat kind="doom" label={t('investigators.doom')} value={investigator.doom} />
        )}
      </dl>
      {clueDrag.shown}
      {damageBack.shown}
      {horrorBack.shown}
      {resourceBack.shown}
      {open && shown && (
        <CounterBubble
          anchor={open.anchor}
          title={t('investigators.counterBubble', {
            investigator: investigator.name,
            counter: shown.label,
          })}
          counts={[{ ...shown, value: String(shown.value) }]}
          onClose={() => setOpen(undefined)}
        />
      )}
    </>
  );
}

/**
 * Where the investigator is and how their round goes: out of the game once defeated or resigned,
 * else their location, marked while it is their turn and once they have taken it.
 */
function statusLine(
  investigator: InvestigatorView,
  onTurn: boolean,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (investigator.status !== 'active') return t(`investigators.${investigator.status}`);
  const location = investigator.at ?? t('investigators.offMap');
  if (onTurn) return t('investigators.turnAt', { location });
  if (investigator.turnTaken) return t('investigators.turnTakenAt', { location });
  return location;
}

/** The counters of an investigator's panel, which the stylesheet gives their icons by. */
type StatKind = 'health' | 'sanity' | 'clues' | 'resources' | 'doom';

/** The counters a double tap opens a − / + bubble on: all but doom, which only cards place. */
type SteppedKind = Exclude<StatKind, 'doom'>;

/** What a counter's bubble shows and does (`CounterBubble`): its name, count and two steps. */
interface Bubble {
  label: string;
  value: number;
  lower: BubbleSide;
  raise: BubbleSide;
  onStep: (delta: -1 | 1) => void;
}

/**
 * The token each counter counts (MD.8b), which it shows its count on. Health and sanity count the
 * damage and horror taken, but show what is left on their printed symbol instead (`PipRing`).
 */
const STAT_TOKENS: Record<StatKind, GameTokenKind> = {
  health: 'damage',
  sanity: 'horror',
  clues: 'clue',
  resources: 'resource',
  doom: 'doom',
};

/**
 * One counter of the panel (`kind`): its name (`short` where the full one does not fit its column,
 * with the full one as its title), its `value` (written as `shown` where the panel says more, such
 * as health against its maximum) and its steppers (`children`). Most show their count on their
 * token (`GameToken`, `STAT_TOKENS`). Health and sanity show as the card prints them (`printed`):
 * an anatomical heart or a brain with what is left on it, in a ring of a pip per point of the
 * printed maximum whose last pips, the damage or horror taken, are greyed (`PipRing`); the whole is
 * one image named by `shown` ("4/7"). A change of the count while it shows plays its effect
 * (`useCountChange`).
 */
function Stat({
  kind,
  label,
  short,
  value,
  shown = String(value),
  printed,
  drag,
  onDoubleTap,
  children,
}: {
  kind: StatKind;
  label: string;
  short?: string;
  value: number;
  shown?: string;
  printed?: { max: number; taken: number };
  /**
   * Makes a token draggable off the count (`useTokenDrag`), marked `data-drag` with its kind: off
   * the printed heart or brain for health and sanity, where the damage or horror lies.
   */
  drag?: TokenDragHandlers | undefined;
  /** Opens the counter's − / + bubble on a double tap (`CounterBubble`), pointing at the counter. */
  onDoubleTap?: (counter: Element) => void;
  children?: ReactNode;
}) {
  const origin = { x: 0, y: 0 };
  const change = useCountChange(value);
  const tap = useDoubleTap((counter) => onDoubleTap?.(counter));
  const bubble = onDoubleTap ? { onClick: tap } : {};
  return (
    <div data-stat={kind}>
      <dt>{short ? <abbr title={label}>{short}</abbr> : label}</dt>
      <dd>
        {printed ? (
          <span
            role="img"
            aria-label={shown}
            data-printed=""
            data-drag={drag && kind}
            {...drag}
            {...bubble}
          >
            <svg viewBox={PRINTED_SYMBOL_VIEW_BOX} aria-hidden="true">
              {kind === 'health' ? (
                <Heart centre={origin} scale={1} />
              ) : (
                <Brain centre={origin} scale={1} />
              )}
              <PipRing max={printed.max} taken={printed.taken} radius={PIP_RING_RADIUS} />
            </svg>
            <data key={change?.key} value={value} data-delta={deltaText(change)}>
              {value}
            </data>
          </span>
        ) : (
          <GameToken
            key={change?.key}
            kind={STAT_TOKENS[kind]}
            count={value}
            label={shown}
            data-delta={deltaText(change)}
            data-drag={drag && kind}
            {...drag}
            {...bubble}
          />
        )}
        {children}
      </dd>
    </div>
  );
}

/** The square around the heart's and brain's drawings (`Heart`, `Brain`), centred on the origin. */
const PRINTED_SYMBOL_VIEW_BOX = '-15 -15 30 30';

/** The pips' circle round the heart or brain, in its drawing's units: just clear of the symbol. */
const PIP_RING_RADIUS = 17;

/** What one stepper of a counter says it does (`label`), since its sign alone does not say. */
interface StepperSide {
  label: string;
  disabled: boolean;
}

/**
 * The − and + buttons of a counter. `onStep` gets −1 or +1 for the counter as shown, so health and
 * sanity turn it around into damage and horror.
 */
function Steppers({
  lower,
  raise,
  onStep,
}: {
  lower: StepperSide;
  raise: StepperSide;
  onStep: (delta: -1 | 1) => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label={lower.label}
        disabled={lower.disabled}
        onClick={() => onStep(-1)}
      >
        −
      </button>
      <button
        type="button"
        aria-label={raise.label}
        disabled={raise.disabled}
        onClick={() => onStep(1)}
      >
        +
      </button>
    </>
  );
}
