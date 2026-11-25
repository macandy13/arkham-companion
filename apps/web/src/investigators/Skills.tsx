import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type BoardView,
  correctSkillBoost,
  type InvestigatorView,
  SKILL_NAMES,
  type SkillName,
} from '@arkham/engine';
import { SkillTestDialog } from './SkillTestDialog';
import { signed } from '../tokens/tokenValue';
import { CounterBubble } from '../screens/CounterBubble';
import { useDoubleTapOn } from '../screens/useDoubleTap';
import { usePlay } from '../screens/PlayContext';

/**
 * The four skills in the order the card prints them, each its value under its icon: the printed
 * value with its lasting boost (`InvestigatorView.boosts`, what player cards in play add), the
 * boost shown beside it, so the printed value stays recognisable. The icon alone does not say
 * which skill it is, so each one is named for screen readers. Tapping one opens a skill test
 * against it (`SkillTestDialog`), a calculator that changes nothing; a double tap opens the − / +
 * bubble of its boost instead (`CounterBubble`, M6.10), so a single tap opens the test only once no
 * second one came (`useDoubleTapOn`, keyed by skill); a step waits while one is queued (`usePlay().busy`).
 */
export function Skills({
  board,
  investigator,
}: {
  board: BoardView;
  investigator: InvestigatorView;
}) {
  const { actions, busy } = usePlay();
  const { t } = useTranslation();
  const [testing, setTesting] = useState<SkillName>();
  const [boosting, setBoosting] = useState<{ skill: SkillName; anchor: Element }>();
  const tapSkill = useDoubleTapOn<SkillName>(
    (skill, anchor) => setBoosting({ skill, anchor }),
    setTesting,
  );
  const { boostedSkills, boosts } = investigator;
  // A defeated or resigned investigator has left the game, so their boosts no longer change.
  const off = busy || investigator.status !== 'active';
  const bubbled = investigator.status === 'active';
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
                onClick={(event) =>
                  bubbled
                    ? tapSkill(skill, event.currentTarget, event.timeStamp)
                    : setTesting(skill)
                }
              >
                <data value={value}>{value}</data>
                {boost !== 0 && <data value={boost}>{signed(boost)}</data>}
              </button>
            </li>
          );
        })}
      </ul>
      {boosting && bubbled && (
        <CounterBubble
          anchor={boosting.anchor}
          title={t('investigators.counterBubble', {
            investigator: investigator.name,
            counter: t('investigators.skillBoost', { skill: t(`skill.${boosting.skill}`) }),
          })}
          counts={[
            {
              label: t(`skill.${boosting.skill}`),
              value: signed(boosts?.[boosting.skill] ?? 0),
              lower: {
                label: t('investigators.lowerBoost', { skill: t(`skill.${boosting.skill}`) }),
                disabled: off,
              },
              raise: {
                label: t('investigators.raiseBoost', { skill: t(`skill.${boosting.skill}`) }),
                disabled: off,
              },
              onStep: (delta) =>
                void actions.correct(correctSkillBoost(investigator.id, boosting.skill, delta)),
            },
          ]}
          onClose={() => setBoosting(undefined)}
        />
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
