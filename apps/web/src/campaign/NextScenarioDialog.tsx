import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  cardDbWith,
  investigatorCardStats,
  investigatorCode,
  scenario as scenarioApi,
  type CampaignInvestigator,
  type CampaignLog,
  type ReplaceInvestigator,
} from '@arkham/engine';
import { useCatalog, type CatalogSource } from '../catalog/useCatalog';
import type { NextScenarioStart } from '../state/appStore';
import type { CampaignEntry, ScenarioEntry } from '../scenarios/scenarioCatalog';
import { chosenInvestigators } from '../wizard/seating';
import { eliminatedMembers, replacementCandidates, teamAfter } from './replacements';
import { ReplacementPicker } from './ReplacementPicker';
import { storyReadLines, type StoryReadLine } from './storyReads';
import './campaign_dialogs.css';

/**
 * The setup preview of a campaign's next scenario (MC1.6d1, docs/product.md "Campaign screen"):
 * the difficulty and team the log sets it up with, and each investigator's unspent experience to
 * spend on deck upgrades at the table first, as the app leaves deck building to the players, and
 * what the log changes in the setup (`storyReadLines`). A killed or insane member needs a
 * replacement first (MC1.6d3), picked from the investigators the campaign hasn't had; with none
 * left, the players can only end the campaign as lost (`onLose`).
 * "Start" hands the game to set up to `onStart`; the team's card stats come from the catalog, as
 * in the new game wizard, so it waits for the catalog to load.
 */
export function NextScenarioDialog({
  log,
  entry,
  scenario,
  catalog: catalogSource,
  onStart,
  onLose,
  onCancel,
}: {
  readonly log: CampaignLog;
  readonly entry: CampaignEntry | undefined;
  readonly scenario: ScenarioEntry;
  readonly catalog: CatalogSource;
  readonly onStart: (start: Omit<NextScenarioStart, 'campaignId'>) => Promise<void>;
  readonly onLose: () => Promise<void>;
  readonly onCancel: () => void;
}) {
  const { t, i18n } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const fromTheLog = entry ? logLines(entry.storyKey) : [];
  const catalog = useCatalog(catalogSource);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [chosen, setChosen] = useState<readonly ReplaceInvestigator[]>([]);
  const [picking, setPicking] = useState<CampaignInvestigator>();
  const scenarioName = t(scenario.nameKey);
  const eliminated = eliminatedMembers(log);
  const investigators = catalog.status === 'ready' ? catalog.catalog.investigators : [];
  const team = chosenInvestigators(investigators, teamAfter(log, chosen));
  const nameOf = (code: string) =>
    investigators.find((investigator) => investigator.code === code)?.name ?? code;
  const candidatesFor = (member: CampaignInvestigator) =>
    replacementCandidates(investigators, log, chosen, member.code);
  const replacementOf = (member: CampaignInvestigator) =>
    chosen.find(({ code }) => code === member.code);
  const ready =
    catalog.status === 'ready' && eliminated.every((member) => replacementOf(member) !== undefined);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function logLines(storyKey: string): StoryReadLine[] {
    try {
      const reads = scenarioApi.storyReadsOfSetup(scenario.definition.setup, log);
      return storyReadLines(t, (key) => i18n.exists(key), storyKey, log, reads);
    } catch (error) {
      // A log entry of the wrong kind is a scenario data error, which "Start" reports too.
      console.warn('Could not read the setup against the campaign log.', error);
      return [];
    }
  }

  function start() {
    if (!ready) return;
    run(
      () =>
        onStart({
          title: [scenarioName, ...team.map(({ name }) => name)].join(' – '),
          ctx: {
            cards: cardDbWith(scenario.cards, team.map(investigatorCardStats)),
            scenario: scenario.definition,
          },
          seed: drawSeed(),
          replacements: chosen,
        }),
      'Could not set the next scenario up.',
    );
  }

  function run(step: () => Promise<void>, failure: string) {
    setBusy(true);
    setFailed(false);
    step()
      .catch((error: unknown) => {
        console.warn(failure, error);
        setFailed(true);
      })
      .finally(() => setBusy(false));
  }

  function choose(member: CampaignInvestigator, by: string) {
    setChosen([
      ...chosen.filter(({ code }) => code !== member.code),
      { type: 'ReplaceInvestigator', code: member.code, by: investigatorCode(by) },
    ]);
    setPicking(undefined);
  }

  return (
    <dialog
      ref={dialog}
      id="next-scenario"
      aria-labelledby="next-scenario-title"
      onCancel={onCancel}
    >
      <hgroup>
        {entry && <p>{t(entry.nameKey)}</p>}
        <h2 id="next-scenario-title">{t('nextScenario.title', { scenario: scenarioName })}</h2>
      </hgroup>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          start();
        }}
      >
        <dl>
          <dt>{t('wizard.difficulty')}</dt>
          <dd>{t(`wizard.difficulties.${log.difficulty}`)}</dd>
          <dt>{t('investigators.title')}</dt>
          <dd>
            <ol>
              {teamAfter(log, chosen).map((code) => (
                <li key={code}>{nameOf(code)}</li>
              ))}
            </ol>
          </dd>
        </dl>
        {eliminated.length > 0 && (
          <section aria-labelledby="next-scenario-replace">
            <h3 id="next-scenario-replace">{t('nextScenario.replace.heading')}</h3>
            <p>{t('nextScenario.replace.rule')}</p>
            <ul>
              {eliminated.map((member) => {
                const replacement = replacementOf(member);
                const noneLeft = catalog.status === 'ready' && candidatesFor(member).length === 0;
                return (
                  <li key={member.code}>
                    <p>{t(`nextScenario.replace.${member.fate}`, { name: member.name })}</p>
                    {replacement && (
                      <p>{t('nextScenario.replace.by', { name: nameOf(replacement.by) })}</p>
                    )}
                    {noneLeft && !replacement ? (
                      <>
                        <p>{t('nextScenario.replace.noneLeft')}</p>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => run(onLose, 'Could not end the campaign.')}
                        >
                          {t('nextScenario.replace.lose')}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={catalog.status !== 'ready'}
                        onClick={() => setPicking(member)}
                      >
                        {t(
                          replacement ? 'nextScenario.replace.change' : 'nextScenario.replace.pick',
                          { name: member.name },
                        )}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <section aria-labelledby="next-scenario-upgrades">
          <h3 id="next-scenario-upgrades">{t('nextScenario.upgrades')}</h3>
          <p>{t('nextScenario.spendXp')}</p>
          <ul>
            {log.investigators
              .filter(({ fate }) => fate === 'alive')
              .map(({ code, name, xpEarned, xpSpent }) => (
                <li key={code}>
                  {t('nextScenario.unspentXp', { name, count: xpEarned - xpSpent })}
                </li>
              ))}
          </ul>
        </section>
        {fromTheLog.length > 0 && (
          <section aria-labelledby="next-scenario-log">
            <h3 id="next-scenario-log">{t('nextScenario.fromTheLog')}</h3>
            <dl>
              {fromTheLog.map(({ entry: logEntry, effects }, index) => (
                // The same entry can be read in two places of a setup, so its text isn't unique.
                <div key={index}>
                  <dt>{logEntry}</dt>
                  {effects.map((effect, effectIndex) => (
                    <dd key={effectIndex}>{effect}</dd>
                  ))}
                </div>
              ))}
            </dl>
          </section>
        )}
        {catalog.status === 'loading' && <p>{t('wizard.loadingCatalog')}</p>}
        {catalog.status === 'failed' && <p role="alert">{t('wizard.catalogFailed')}</p>}
        {failed && <p role="alert">{t('nextScenario.failed')}</p>}
        <footer>
          <button type="button" onClick={onCancel}>
            {t('games.cancel')}
          </button>
          <button type="submit" disabled={busy || !ready}>
            {t('wizard.start')}
          </button>
        </footer>
      </form>
      {picking && catalog.status === 'ready' && (
        <ReplacementPicker
          name={picking.name}
          catalog={{ ...catalog.catalog, investigators: candidatesFor(picking) }}
          onChoose={(by) => choose(picking, by)}
          onCancel={() => setPicking(undefined)}
        />
      )}
    </dialog>
  );
}

/** A new game's seed; the engine never reads randomness itself, so it is drawn at the edge. */
function drawSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
