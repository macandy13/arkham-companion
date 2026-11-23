import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView, InvestigatorId } from '@arkham/engine';
import type { TestByCard } from '../state/gameActions';
import { ActionButton, ActionGroup } from './ActionRow';

/**
 * The tests a card lets an investigator make on this location or enemy outside their turn or
 * from another location (`GameActions.testByCard`: In the Know, Counterpunch, Marksmanship), a
 * group of the details' action row. With one active investigator a tap starts the test; with
 * more the group asks who tests (its title and buttons turn to their names, and Cancel), since
 * a button per test and investigator would crowd the row.
 */
export function TestsByCard({
  board,
  tests,
  busy,
  onTest,
}: {
  board: BoardView;
  tests: readonly TestByCard[];
  busy: boolean;
  onTest: (kind: TestByCard, investigator: InvestigatorId) => void;
}) {
  const { t } = useTranslation();
  const [picking, setPicking] = useState<TestByCard>();
  const testers = board.investigators.filter(
    (investigator) =>
      investigator.status === 'active' && board.locationOf(investigator.id) !== undefined,
  );
  if (tests.length === 0 || testers.length === 0) return null;
  if (picking !== undefined)
    return (
      <ActionGroup title={t(`byCard.who.${picking}`)}>
        {testers.map((investigator) => (
          <ActionButton
            key={investigator.id}
            icon={picking}
            caption={investigator.name}
            name={t('byCard.testBy', {
              test: t(`byCard.${picking}`),
              name: investigator.name,
            })}
            disabled={busy}
            onClick={() => {
              setPicking(undefined);
              onTest(picking, investigator.id);
            }}
          />
        ))}
        <button type="button" onClick={() => setPicking(undefined)}>
          {t('games.cancel')}
        </button>
      </ActionGroup>
    );
  return (
    <ActionGroup title={t('byCard.title')}>
      {tests.map((kind) => (
        <ActionButton
          key={kind}
          icon={kind}
          caption={t(`byCard.${kind}`)}
          name={t('byCard.test', { test: t(`byCard.${kind}`) })}
          disabled={busy}
          onClick={() => {
            const [only] = testers;
            if (testers.length === 1 && only) onTest(kind, only.id);
            else setPicking(kind);
          }}
        />
      ))}
    </ActionGroup>
  );
}
