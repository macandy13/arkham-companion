import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type BoardView, type InvestigatorView, placeYourClues } from '@arkham/engine';
import { Brain, Heart } from '../catalog/cardFace';
import type { SteppedStat } from '../state/gameActions';
import { deltaText, useCountChange } from '../screens/countChange';
import type { TokenDragHandlers } from '../screens/useTokenDrag';
import { useReturnToPool } from '../screens/useReturnToPool';
import { GameToken, type GameTokenKind } from '../tokens/GameToken';
import { PipRing } from './PipRing';
import { useClueDrag } from './useClueDrag';
import { CounterBubble, type BubbleSide } from '../screens/CounterBubble';
import { useDoubleTap } from '../screens/useDoubleTap';
import { takeOneClue } from '../state/gameActions';
import { usePlay } from '../screens/PlayContext';

/**
 * The counters on the card's notebook page, each a token like the ones on the table; a step plays
 * the open game's actions unless one is queued (`usePlay().busy`). A clue can be dragged off the clue count onto their location or the act
 * (`useClueDrag`), and damage, horror or a resource back onto the header's token pool, which heals
 * or spends it (`useReturnToPool`). A double tap on a counter opens its − / + bubble
 * (`CounterBubble`, M6.9), whose steps go by rule, so damage can defeat; a
 * clue goes to or comes from their location, as dragging it does, since the game's clues only
 * move between investigators and locations.
 */
export function Counters({
  board,
  investigator,
}: {
  /** The board a clue dragged off the card lands on (`useClueDrag`). */
  board: BoardView;
  investigator: InvestigatorView;
}) {
  const { actions, busy } = usePlay();
  const { t } = useTranslation();
  const { id, health, damage, sanity, horror } = investigator;
  // A stepper's damage or horror defeats by the rules, so it is performed, not corrected.
  const adjust = (stat: SteppedStat, delta: number) =>
    void actions.perform({ type: 'AdjustInvestigator', investigatorId: id, stat, delta });
  // A defeated or resigned investigator has left the game, so their counters no longer change.
  const off = busy || investigator.status !== 'active';
  const clueDrag = useClueDrag(board, id);
  const damageBack = useReturnToPool('damage', () => adjust('damage', -1));
  const horrorBack = useReturnToPool('horror', () => adjust('horror', -1));
  const resourceBack = useReturnToPool('resource', () => adjust('resources', -1));
  const dragOff = (count: number, drag: TokenDragHandlers) =>
    off || count === 0 ? undefined : drag;
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
      onStep: (delta) =>
        void (delta < 0
          ? actions.perform(placeYourClues(1, id))
          : at && actions.perform(takeOneClue(at, id))),
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
  // Not while a step is queued, nor once they left the game.
  const bubbleFor = (kind: SteppedKind) =>
    off ? {} : { onDoubleTap: (anchor: Element) => setOpen({ kind, anchor }) };
  // Kept open while its own step is queued (`usePlay().busy`), its buttons off, so it doesn't flicker.
  const shown = open && investigator.status === 'active' ? bubbles[open.kind] : undefined;
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
        />
        <Stat
          kind="sanity"
          label={t('investigators.sanity')}
          value={sanity - horror}
          shown={t('investigators.left', { left: sanity - horror, max: sanity })}
          printed={{ max: sanity, taken: horror }}
          drag={dragOff(horror, horrorBack.handlers)}
          {...bubbleFor('sanity')}
        />
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
        />
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
export function statusLine(
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
 * as health against its maximum). Most show their count on their
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
      </dd>
    </div>
  );
}

/** The square around the heart's and brain's drawings (`Heart`, `Brain`), centred on the origin. */
const PRINTED_SYMBOL_VIEW_BOX = '-15 -15 30 30';

/** The pips' circle round the heart or brain, in its drawing's units: just clear of the symbol. */
const PIP_RING_RADIUS = 17;
