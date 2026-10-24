import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView, DecisionView } from '@arkham/engine';
import type { GameActions } from '../state/gameActions';

/**
 * The first open decision (`BoardView.decisions[0]`) as a modal over the board: the question in
 * the players' words with the card it is about, the investigator who answers it, the test of a
 * skill test, and one button per option, answered through `GameActions.answer` with the default
 * counts. The game cannot go on before it is answered, so Escape does not close it; Undo takes back
 * the step that raised it instead. The engine's labels are i18n keys or names already readable
 * (investigators, locations); a key the strings lack shows as the option's readable name.
 */
export function DecisionDialog({
  board,
  decision,
  actions,
  busy,
}: {
  board: BoardView;
  decision: DecisionView;
  actions: GameActions;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const { test } = decision;

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => event.preventDefault()}
      data-dialog="decision"
    >
      <h2 id={titleId}>
        {t(decision.prompt, { card: decision.about, defaultValue: decision.prompt })}
      </h2>
      {decision.for !== undefined && (
        <p>{t('decision.decides', { name: board.investigator(decision.for).name })}</p>
      )}
      {test && (
        <p>
          {t('decision.test', { skill: t(`skill.${test.skill}`), difficulty: test.difficulty })}
        </p>
      )}
      <ul>
        {decision.options.map((option) => (
          <li key={option}>
            <button type="button" disabled={busy} onClick={() => void actions.answer(option)}>
              {t(decision.labels?.[option] ?? option, { defaultValue: option })}
            </button>
          </li>
        ))}
      </ul>
      <footer>
        <button type="button" disabled={busy} onClick={() => void actions.undo()}>
          {t('header.undo')}
        </button>
      </footer>
    </dialog>
  );
}
