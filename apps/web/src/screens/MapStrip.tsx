import { useTranslation } from 'react-i18next';
import { SKILL_NAMES, type BoardView, type InvestigatorView, type SkillName } from '@arkham/engine';
import { actClues } from './GameHeader';
import type { DetailTarget } from './useDetailView';

/** One value on a strip: what the stylesheet draws its icon by, and the value as the strip shows it. */
interface StripValue {
  kind: 'doom' | 'clues' | 'cards' | 'round' | 'actions' | 'health' | 'sanity' | 'resources';
  shown: string;
  /** The value in words, which the strip's name is made of. */
  label: string;
}

/**
 * An edge strip of the map row in the phone's detail view (M3.14c), a button leading to the row
 * on its side (`to`): `onGo` moves the view to the agenda, or to the panel of the strip's
 * investigator. Above the map the numbers of the cards row (the agenda's doom, the act's clues,
 * the encounter deck and the round), below it those of the investigator whose turn it is, else
 * the lead, else the first (their actions left on their turn, counters and skills). The map takes
 * all touches in that row, so a vertical swipe to the next row starts on a strip. Its values only
 * show as numbers and icons, so its name says them in words.
 */
export function MapStrip({
  board,
  to,
  onGo,
}: {
  board: BoardView;
  to: 'cards' | 'investigators';
  onGo: (target: DetailTarget) => void;
}) {
  const { t } = useTranslation();
  const values = to === 'cards' ? cardValues(board, t) : investigatorValues(board, t);
  if (!values) return null;
  return (
    <button
      type="button"
      data-strip={to}
      aria-label={values.label}
      onClick={() => onGo(values.target)}
    >
      {values.name && <span aria-hidden="true">{values.name}</span>}
      {values.items.map(({ kind, shown }) => (
        <span key={kind} aria-hidden="true" data-stat={kind}>
          {shown}
        </span>
      ))}
      {values.skills?.map(({ skill, value }) => (
        <span key={skill} aria-hidden="true" data-skill={skill}>
          {value}
        </span>
      ))}
    </button>
  );
}

type Translate = ReturnType<typeof useTranslation>['t'];

/** What a strip shows and says: an optional name first, its values, the skills on the lower one. */
interface StripValues {
  label: string;
  /** Where a tap on the strip takes the view. */
  target: DetailTarget;
  name?: string;
  items: StripValue[];
  skills?: { skill: SkillName; value: number }[];
}

/** The upper strip: the cards row's numbers, the ones each card's token shows there. */
function cardValues(board: BoardView, t: Translate): StripValues {
  const items: StripValue[] = [];
  const { agenda, act } = board;
  if (agenda?.threshold !== undefined) {
    const doom = board.doomInPlay;
    items.push({
      kind: 'doom',
      shown: `${doom}/${agenda.threshold}`,
      label: t('header.doomOf', { doom, threshold: agenda.threshold }),
    });
  }
  if (act?.advance) {
    const { advance } = act;
    const clues = actClues(act, advance);
    items.push({
      kind: 'clues',
      shown: `${clues}/${advance.threshold}`,
      label: t('header.cluesOf', { clues, threshold: advance.threshold }),
    });
  }
  const count = board.encounter.deckCount;
  items.push({
    kind: 'cards',
    shown: String(count),
    label: t('header.encounterDeckCount', { count }),
  });
  const phase = t(`games.phases.${board.phase}`);
  const round =
    board.phase === 'setup' ? phase : `${t('header.round', { round: board.round })} · ${phase}`;
  items.push({ kind: 'round', shown: round, label: round });
  return {
    label: items.map((item) => item.label).join(', '),
    target: { row: 'cards', card: 'agenda' },
    items,
  };
}

/** The lower strip: the numbers of the turn's investigator, else of the lead, else of the first. */
function investigatorValues(board: BoardView, t: Translate): StripValues | undefined {
  const id = board.turn ?? board.lead ?? board.investigators[0]?.id;
  const investigator = board.investigators.find((candidate) => candidate.id === id);
  if (!investigator) return undefined;
  const items = investigatorCounters(investigator, board.turn === investigator.id, t);
  const skills = SKILL_NAMES.map((skill) => ({
    skill,
    value: investigator.boostedSkills[skill],
  }));
  const label = [
    investigator.name,
    ...items.map((item) => item.label),
    ...skills.map(({ skill, value }) =>
      t('investigators.skillValue', { skill: t(`skill.${skill}`), value }),
    ),
  ].join(', ');
  return {
    label,
    target: { row: 'investigators', investigator: investigator.id },
    name: investigator.name,
    items,
    skills,
  };
}

/** An investigator's counters on the lower strip, after their actions left while `onTurn`. */
function investigatorCounters(
  investigator: InvestigatorView,
  onTurn: boolean,
  t: Translate,
): StripValue[] {
  const { health, damage, sanity, horror } = investigator;
  const counter = (kind: StripValue['kind'], stat: string, shown: string): StripValue => ({
    kind,
    shown,
    label: t('investigators.skillValue', { skill: stat, value: shown }),
  });
  const items: StripValue[] = [];
  if (onTurn)
    items.push({
      kind: 'actions',
      shown: String(investigator.actions),
      label: t('investigators.actionsLeft', { count: investigator.actions }),
    });
  items.push(
    counter(
      'health',
      t('investigators.health'),
      t('investigators.left', { left: health - damage, max: health }),
    ),
    counter(
      'sanity',
      t('investigators.sanity'),
      t('investigators.left', { left: sanity - horror, max: sanity }),
    ),
    counter('clues', t('investigators.clues'), String(investigator.clues)),
    counter('resources', t('investigators.resources'), String(investigator.resources)),
  );
  return items;
}
