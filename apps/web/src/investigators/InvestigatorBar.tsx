import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView, InvestigatorView } from '@arkham/engine';
import type { GameActions, SteppedStat } from '../state/gameActions';
import './investigators.css';

/**
 * The bar of investigator panels along the foot of the play screen, one per investigator in seat
 * order (`BoardView.investigators`), so everyone's status is in view at once. It replaces the
 * health and sanity dials and the clue and resource piles on the table: each change is a tap on a
 * stepper, which plays `actions`; nothing is tapped while a step is queued (`busy`).
 */
export function InvestigatorBar({
  board,
  actions,
  busy,
}: {
  board: BoardView;
  actions: GameActions;
  busy: boolean;
}) {
  return (
    <>
      {board.investigators.map((investigator) => (
        <InvestigatorPanel
          key={investigator.id}
          investigator={investigator}
          onTurn={board.turn === investigator.id}
          actions={actions}
          busy={busy}
        />
      ))}
    </>
  );
}

/**
 * One investigator, laid out like the prototype's panel: their card with the name band, a line
 * saying where they are and how their round goes, and their counters. Health and sanity show what
 * is left of the printed value, like the dials, while their steppers place and heal damage and
 * horror, like the tokens on the card. Clues show without steppers: they are found by
 * investigating and spent on the act.
 */
function InvestigatorPanel({
  investigator,
  onTurn,
  actions,
  busy,
}: {
  investigator: InvestigatorView;
  onTurn: boolean;
  actions: GameActions;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const nameId = useId();
  const { id, health, damage, sanity, horror } = investigator;
  const adjust = (stat: SteppedStat, delta: number) => void actions.adjust(id, stat, delta);
  // A defeated or resigned investigator has left the game, so their counters no longer change.
  const off = busy || investigator.status !== 'active';
  return (
    <section
      aria-labelledby={nameId}
      data-status={investigator.status}
      data-turn={onTurn || undefined}
    >
      <figure data-card="investigator">
        <figcaption>
          <h3 id={nameId}>{investigator.name}</h3>
        </figcaption>
      </figure>
      <p>{statusLine(investigator, onTurn, t)}</p>
      <dl>
        <Stat
          label={t('investigators.health')}
          value={health - damage}
          shown={t('investigators.left', { left: health - damage, max: health })}
        >
          <Steppers
            lower={{ label: t('investigators.takeDamage'), disabled: off }}
            raise={{ label: t('investigators.healDamage'), disabled: off || damage === 0 }}
            onStep={(delta) => adjust('damage', -delta)}
          />
        </Stat>
        <Stat
          label={t('investigators.sanity')}
          value={sanity - horror}
          shown={t('investigators.left', { left: sanity - horror, max: sanity })}
        >
          <Steppers
            lower={{ label: t('investigators.takeHorror'), disabled: off }}
            raise={{ label: t('investigators.healHorror'), disabled: off || horror === 0 }}
            onStep={(delta) => adjust('horror', -delta)}
          />
        </Stat>
        <Stat label={t('investigators.clues')} value={investigator.clues} />
        <Stat label={t('investigators.resources')} value={investigator.resources}>
          <Steppers
            lower={{
              label: t('investigators.spendResource'),
              disabled: off || investigator.resources === 0,
            }}
            raise={{ label: t('investigators.gainResource'), disabled: off }}
            onStep={(delta) => adjust('resources', delta)}
          />
        </Stat>
        {investigator.doom !== undefined && (
          <Stat label={t('investigators.doom')} value={investigator.doom} />
        )}
      </dl>
    </section>
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

/**
 * One counter of the panel: its name, its `value` (written as `shown` where the panel says more,
 * such as health against its maximum) and its steppers (`children`).
 */
function Stat({
  label,
  value,
  shown = String(value),
  children,
}: {
  label: string;
  value: number;
  shown?: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <data value={value}>{shown}</data>
        {children}
      </dd>
    </div>
  );
}

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
