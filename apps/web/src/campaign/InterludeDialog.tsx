import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  campaign,
  type CampaignCommand,
  type CampaignLog,
  type InterludeDefinition,
} from '@arkham/engine';
import { ProposedChanges, confirmedCommands, useDescribeCommand } from './ProposedChanges';
import './campaign_dialogs.css';

/**
 * An interlude between two scenarios (MC1.6e), read like a resolution (`ResolutionDialog`): the
 * players read it aloud from the campaign guide, answer each decision it asks, one at a time and
 * in the guide's order (`campaign.proposeInterlude`), then confirm what it writes into the log,
 * picking an investigator where it asks for one. "Back" takes the last answer back; before the
 * first, "Not yet" closes the dialog. Writing hands the confirmed commands to `onWrite`; `failed`
 * says the last write was refused, so the log is unchanged. The app shows no guide text: the
 * interlude's name is `<storyKey>.interludes.<id>`, its decisions the keys the definition names.
 */
export function InterludeDialog({
  log,
  interlude,
  storyKey,
  busy,
  failed,
  onWrite,
  onLater,
}: {
  readonly log: CampaignLog;
  readonly interlude: InterludeDefinition;
  /** `CampaignEntry.storyKey` of the campaign. */
  readonly storyKey: string | undefined;
  readonly busy: boolean;
  readonly failed: boolean;
  readonly onWrite: (confirmed: readonly CampaignCommand[]) => void;
  readonly onLater: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const [answers, setAnswers] = useState<readonly number[]>([]);
  // The option the open question has picked, before "Next" makes it an answer.
  const [selected, setSelected] = useState(0);
  // The option each choice has picked, by the choice's place in the changes.
  const [picks, setPicks] = useState<ReadonlyMap<number, number>>(new Map());
  const describe = useDescribeCommand(log, storyKey);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const proposal = campaign.proposeInterlude(log, interlude, answers);
  const name = t(`${storyKey}.interludes.${interlude.id}`);
  const answer = (next: readonly number[]) => {
    setAnswers(next);
    setSelected(0);
    setPicks(new Map());
  };

  return (
    <dialog
      ref={dialog}
      id="interlude"
      aria-labelledby="interlude-title"
      onCancel={(event) => {
        // Escape is "Not yet", which the parent decides on, not the browser.
        event.preventDefault();
        onLater();
      }}
    >
      <hgroup>
        <p>{t('interlude.kicker')}</p>
        <h2 id="interlude-title">{proposal.kind === 'question' ? name : t('interlude.title')}</h2>
      </hgroup>
      <p>{answers.length === 0 ? t('interlude.read', { name }) : t('interlude.readOn')}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (proposal.kind === 'question') answer([...answers, selected]);
          else onWrite(confirmedCommands(proposal.changes, picks));
        }}
      >
        {proposal.kind === 'question' ? (
          <fieldset>
            <legend>{t(proposal.question.questionKey)}</legend>
            {proposal.question.options.map((labelKey, index) => (
              <label key={labelKey}>
                <input
                  type="radio"
                  name="interlude-answer"
                  checked={selected === index}
                  onChange={() => setSelected(index)}
                />
                {t(labelKey)}
              </label>
            ))}
          </fieldset>
        ) : (
          <ProposedChanges
            changes={proposal.changes}
            picks={picks}
            onPick={(index, option) => setPicks(new Map(picks).set(index, option))}
            describe={describe}
            idPrefix="interlude"
          />
        )}
        {failed && <p role="alert">{t('resolution.failed')}</p>}
        <footer>
          {answers.length === 0 ? (
            <button type="button" onClick={onLater}>
              {t('resolution.later')}
            </button>
          ) : (
            <button type="button" onClick={() => answer(answers.slice(0, -1))}>
              {t('resolution.back')}
            </button>
          )}
          <button type="submit" disabled={busy}>
            {proposal.kind === 'question' ? t('resolution.next') : t('resolution.write')}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
