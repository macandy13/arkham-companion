import { useId, useState, type ReactNode } from 'react';
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
import { useCardPicture } from '../catalog/cardImages';
import type { GameActions, SteppedStat } from '../state/gameActions';
import { InvestigatorArt } from './InvestigatorArt';
import { InvestigatorFace, classOf, type PrintedInvestigator } from './InvestigatorFace';
import { SkillTestDialog } from './SkillTestDialog';
import { signed } from './TestCalculation';
import { PlayArea } from './PlayArea';
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
 *
 * A phone has room for one panel only, so there the stylesheet shows just the focused one
 * (`data-focus`) with the others as avatar buttons above it (`OtherInvestigators`); a wider screen
 * shows every panel and hides the avatars. Focus follows the turn, see `useFocus`. With `onOpen`
 * (the phone's compact view), the focused investigator's name is a button that opens the detail
 * view on their panel.
 */
export function InvestigatorBar({
  board,
  actions,
  busy,
  adjusting,
  onOpen,
  printed,
}: {
  board: BoardView;
  actions: GameActions;
  busy: boolean;
  adjusting: boolean;
  onOpen?: ((investigator: InvestigatorId) => void) | undefined;
  /** Looks up what each investigator's card prints (`printedInvestigatorOf`), once the catalog has loaded. */
  printed?: ((code: InvestigatorCode) => PrintedInvestigator | undefined) | undefined;
}) {
  // The players pick who goes next in the investigation phase, once no turn is in progress.
  const picking = board.phase === 'investigation' && board.turn === undefined;
  const [focus, setFocus] = useFocus(board);
  return (
    <>
      <OtherInvestigators board={board} focus={focus} onFocus={setFocus} />
      {board.investigators.map((investigator) => (
        <InvestigatorPanel
          key={investigator.id}
          board={board}
          investigator={investigator}
          printed={printed?.(investigator.code)}
          focused={focus === investigator.id}
          onOpen={focus === investigator.id ? onOpen : undefined}
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

/** Names the turn in progress, or the time between turns, uniquely within a game (`useFocus`). */
function turnKey(board: BoardView): string {
  return `${board.round}:${board.phase}:${board.turn ?? ''}`;
}

/**
 * The investigators besides the focused one (`focus`, see `useFocus`) as round avatars of their
 * card's art, or their initial like their pawn on the map until it loads, each a button that
 * brings their panel to the front (`onFocus`). Only the phone shows them; nothing in a solo game.
 */
function OtherInvestigators({
  board,
  focus,
  onFocus,
}: {
  board: BoardView;
  focus: InvestigatorId | undefined;
  onFocus: (id: InvestigatorId) => void;
}) {
  const { t } = useTranslation();
  const others = board.investigators.filter(({ id }) => id !== focus);
  if (others.length === 0) return null;
  return (
    <ul aria-label={t('investigators.others')}>
      {others.map((investigator) => (
        <li key={investigator.id} data-turn={board.turn === investigator.id || undefined}>
          <button
            type="button"
            aria-label={t('investigators.show', { name: investigator.name })}
            onClick={() => onFocus(investigator.id)}
          >
            <span>{investigator.name.charAt(0)}</span>
            <InvestigatorArt image={investigator.image} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * One investigator: their threat area along the top edge of their card, the card drawn as the
 * printed one (`InvestigatorFace`) with the name and subname on its plates (`printed`), the four
 * skills on their chain and the counters at the foot of its notebook page, then where they are and how their round goes, the cards they control (`PlayArea`) and
 * their turn controls. Before where they are, a pentagon marks the lead investigator, like the
 * game's lead investigator token, and an action arrow the investigator whose turn it is.
 * Health and sanity show what is left of the printed value, like the dials, while their steppers
 * place and heal damage and horror, like the tokens on the card. Clues show without steppers: they
 * are found by investigating and spent on the act.
 */
function InvestigatorPanel({
  board,
  investigator,
  printed,
  focused,
  onOpen,
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
  /** What their card prints besides its stats, once the catalog has it. */
  printed: PrintedInvestigator | undefined;
  /** The phone shows this panel in full (`useFocus`). */
  focused: boolean;
  /** Opens the phone's detail view on this panel, from a tap on the name. */
  onOpen: ((investigator: InvestigatorId) => void) | undefined;
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
  return (
    <section
      aria-labelledby={nameId}
      data-status={investigator.status}
      data-turn={onTurn || undefined}
      data-focus={focused || undefined}
      data-investigator={investigator.id}
    >
      <ThreatArea
        board={board}
        treacheries={board.cardsIn({ kind: 'threatArea', investigatorId: investigator.id })}
        enemies={engaged}
        actions={actions}
        // Fighting and evading are play, so they wait while the players adjust, like the turn's.
        busy={busy || adjusting}
      />
      <article
        data-card="investigator"
        data-picture={picture?.shown ? 'shown' : undefined}
        data-adjusting={adjusting || undefined}
      >
        <InvestigatorFace picture={picture} investigatorClass={classOf(printed?.factionCode)} />
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
        <Skills
          board={board}
          investigator={investigator}
          adjusting={adjusting}
          busy={busy}
          actions={actions}
        />
        <Counters investigator={investigator} adjusting={adjusting} busy={busy} actions={actions} />
      </article>
      <p data-whereabouts="">
        {lead && <span role="img" aria-label={t('investigators.lead')} data-marker="lead" />}
        {onTurn && <span role="img" aria-label={t('investigators.onTurn')} data-marker="turn" />}
        {statusLine(investigator, onTurn, t)}
      </p>
      <PlayArea
        board={board}
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
 * against it (`SkillTestDialog`), a calculator that changes nothing; while the players adjust the
 * board, steppers under each change its boost, unless a step is queued (`busy`).
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
              {adjusting && (
                <Steppers
                  lower={{ label: t('investigators.lowerBoost', { skill: name }), disabled: off }}
                  raise={{ label: t('investigators.raiseBoost', { skill: name }), disabled: off }}
                  onStep={(delta) => void actions.boostSkill(investigator.id, skill, delta)}
                />
              )}
            </li>
          );
        })}
      </ul>
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
 * The counters on the card's notebook page, each a token like the ones on the table, with their steppers while the
 * players adjust the board (`adjusting`); a step plays `actions` unless one is queued (`busy`).
 */
function Counters({
  investigator,
  adjusting,
  busy,
  actions,
}: {
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
  return (
    <dl>
      <Stat
        kind="health"
        label={t('investigators.health')}
        value={health - damage}
        shown={t('investigators.left', { left: health - damage, max: health })}
        printed={{ max: health, taken: damage }}
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
 * as health against its maximum) and its steppers (`children`). Health and sanity show as the card
 * prints them (`printed`): the printed maximum on an anatomical heart or a brain, with the damage
 * or horror taken as a count circle on its lower right, like the location's clues on its clue
 * value; the pair is one image named by `shown`, since the two numbers alone do not say what is
 * left.
 */
function Stat({
  kind,
  label,
  short,
  value,
  shown = String(value),
  printed,
  children,
}: {
  kind: StatKind;
  label: string;
  short?: string;
  value: number;
  shown?: string;
  printed?: { max: number; taken: number };
  children?: ReactNode;
}) {
  const origin = { x: 0, y: 0 };
  return (
    <div data-stat={kind}>
      <dt>{short ? <abbr title={label}>{short}</abbr> : label}</dt>
      <dd>
        {printed ? (
          <span role="img" aria-label={shown} data-printed="">
            <svg viewBox={PRINTED_SYMBOL_VIEW_BOX} aria-hidden="true">
              {kind === 'health' ? (
                <Heart centre={origin} scale={1} />
              ) : (
                <Brain centre={origin} scale={1} />
              )}
            </svg>
            <data value={printed.max}>{printed.max}</data>
            <data value={printed.taken} data-count="" data-empty={printed.taken === 0 || undefined}>
              {printed.taken}
            </data>
          </span>
        ) : (
          <data value={value}>{shown}</data>
        )}
        {children}
      </dd>
    </div>
  );
}

/** The square around the heart's and brain's drawings (`Heart`, `Brain`), centred on the origin. */
const PRINTED_SYMBOL_VIEW_BOX = '-15 -15 30 30';

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
