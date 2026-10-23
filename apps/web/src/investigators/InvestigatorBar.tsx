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
          value={t('investigators.left', { left: health - damage, max: health })}
        >
          <Stepper
            label={t('investigators.takeDamage')}
            disabled={off}
            onClick={() => adjust('damage', 1)}
          >
            −
          </Stepper>
          <Stepper
            label={t('investigators.healDamage')}
            disabled={off || damage === 0}
            onClick={() => adjust('damage', -1)}
          >
            +
          </Stepper>
        </Stat>
        <Stat
          label={t('investigators.sanity')}
          value={t('investigators.left', { left: sanity - horror, max: sanity })}
        >
          <Stepper
            label={t('investigators.takeHorror')}
            disabled={off}
            onClick={() => adjust('horror', 1)}
          >
            −
          </Stepper>
          <Stepper
            label={t('investigators.healHorror')}
            disabled={off || horror === 0}
            onClick={() => adjust('horror', -1)}
          >
            +
          </Stepper>
        </Stat>
        <Stat label={t('investigators.clues')} value={String(investigator.clues)} />
        <Stat label={t('investigators.resources')} value={String(investigator.resources)}>
          <Stepper
            label={t('investigators.spendResource')}
            disabled={off || investigator.resources === 0}
            onClick={() => adjust('resources', -1)}
          >
            −
          </Stepper>
          <Stepper
            label={t('investigators.gainResource')}
            disabled={off}
            onClick={() => adjust('resources', 1)}
          >
            +
          </Stepper>
        </Stat>
        {investigator.doom !== undefined && (
          <Stat label={t('investigators.doom')} value={String(investigator.doom)} />
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

/** One counter of the panel: its name, its value and the steppers that change it (`children`). */
function Stat({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <data value={value}>{value}</data>
        {children}
      </dd>
    </div>
  );
}

/** A small − or + button of a counter, named for what it does (`label`), since its sign alone does not say. */
function Stepper({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
