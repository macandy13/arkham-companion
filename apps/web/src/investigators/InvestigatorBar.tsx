import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SKILL_NAMES,
  type BoardView,
  type CardImagePath,
  type EnemyView,
  type InvestigatorView,
  type SkillValues,
} from '@arkham/engine';
import { useCardPicture } from '../catalog/cardImages';
import type { GameActions, SteppedStat } from '../state/gameActions';
import { ThreatArea } from './ThreatArea';
import { TurnControls } from './TurnControls';
import './investigators.css';

/**
 * The bar of investigator panels along the foot of the play screen, one per investigator in seat
 * order (`BoardView.investigators`), so everyone's status is in view at once. It replaces the
 * health and sanity dials and the clue and resource piles on the table: each change is a tap on a
 * stepper, which plays `actions`; nothing is tapped while a step is queued (`busy`). The steppers
 * show only while the players adjust the board (`adjusting`, `OpenGame.adjusting`), and the turn
 * controls wait meanwhile, since a turn step is play, not a correction.
 */
export function InvestigatorBar({
  board,
  actions,
  busy,
  adjusting,
}: {
  board: BoardView;
  actions: GameActions;
  busy: boolean;
  adjusting: boolean;
}) {
  // The players pick who goes next in the investigation phase, once no turn is in progress.
  const picking = board.phase === 'investigation' && board.turn === undefined;
  return (
    <>
      {board.investigators.map((investigator) => (
        <InvestigatorPanel
          key={investigator.id}
          investigator={investigator}
          onTurn={board.turn === investigator.id}
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
 * One investigator, laid out like the prototype's panel: their threat area along the top edge of
 * their card, the card, and beside it their name, a line saying where they are and how their
 * round goes, their skills and their turn controls, then their counters in a row, each name after
 * its icon. Health and sanity show what is left of the printed value,
 * like the dials, while their steppers place and heal damage and horror, like the tokens on the
 * card. Clues show without steppers: they are found by investigating and spent on the act.
 */
function InvestigatorPanel({
  investigator,
  onTurn,
  engaged,
  canStart,
  actions,
  busy,
  adjusting,
}: {
  investigator: InvestigatorView;
  onTurn: boolean;
  /** The enemies engaged with the investigator, shown in their threat area. */
  engaged: readonly EnemyView[];
  /** The players may start this investigator's turn now (`TurnControls`). */
  canStart: boolean;
  actions: GameActions;
  busy: boolean;
  adjusting: boolean;
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
      <ThreatArea treacheries={investigator.threatArea ?? []} enemies={engaged} />
      <InvestigatorCardFace image={investigator.image} />
      <h3 id={nameId}>{investigator.name}</h3>
      <p>{statusLine(investigator, onTurn, t)}</p>
      <Skills skills={investigator.skills} />
      <TurnControls
        investigator={investigator}
        onTurn={onTurn}
        canStart={canStart}
        actions={actions}
        busy={busy || adjusting}
      />
      <dl>
        <Stat
          kind="health"
          label={t('investigators.health')}
          value={health - damage}
          shown={t('investigators.left', { left: health - damage, max: health })}
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
        >
          {adjusting && (
            <Steppers
              lower={{ label: t('investigators.takeHorror'), disabled: off }}
              raise={{ label: t('investigators.healHorror'), disabled: off || horror === 0 }}
              onStep={(delta) => adjust('horror', -delta)}
            />
          )}
        </Stat>
        <Stat kind="clues" label={t('investigators.clues')} value={investigator.clues} />
        <Stat
          kind="resources"
          label={t('investigators.resources')}
          short={t('investigators.resourcesShort')}
          value={investigator.resources}
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
    </section>
  );
}

/**
 * The investigator card, like ArkhamDB shows it: the picture of its front fills the frame once it
 * has loaded (`data-picture`); until then, and for good when it fails, the frame shows the hatched
 * art area.
 */
function InvestigatorCardFace({ image }: { image: CardImagePath | undefined }) {
  const picture = useCardPicture(image);
  return (
    <figure data-card="investigator" data-picture={picture?.shown ? 'shown' : undefined}>
      {picture && (
        <img src={picture.url} alt="" onLoad={picture.onLoad} onError={picture.onError} />
      )}
    </figure>
  );
}

/**
 * The four skills in the order the card prints them, each its value under its icon. The icon
 * alone does not say which skill it is, so each one is named for screen readers.
 */
function Skills({ skills }: { skills: SkillValues }) {
  const { t } = useTranslation();
  return (
    <ul aria-label={t('investigators.skills')}>
      {SKILL_NAMES.map((skill) => (
        <li
          key={skill}
          data-skill={skill}
          aria-label={t('investigators.skillValue', {
            skill: t(`skill.${skill}`),
            value: skills[skill],
          })}
        >
          <data value={skills[skill]}>{skills[skill]}</data>
        </li>
      ))}
    </ul>
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

/**
 * One counter of the panel (`kind`): its name (`short` where the full one does not fit its column,
 * with the full one as its title), its `value` (written as `shown` where the panel says more, such
 * as health against its maximum) and its steppers (`children`).
 */
function Stat({
  kind,
  label,
  short,
  value,
  shown = String(value),
  children,
}: {
  kind: StatKind;
  label: string;
  short?: string;
  value: number;
  shown?: string;
  children?: ReactNode;
}) {
  return (
    <div data-stat={kind}>
      <dt>{short ? <abbr title={label}>{short}</abbr> : label}</dt>
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
