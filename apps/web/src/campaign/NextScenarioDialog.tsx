import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cardDbWith, investigatorCardStats, type CampaignLog } from '@arkham/engine';
import { useCatalog, type CatalogSource } from '../catalog/useCatalog';
import type { NextScenarioStart } from '../state/appStore';
import type { CampaignEntry, ScenarioEntry } from '../scenarios/scenarioCatalog';
import { chosenInvestigators } from '../wizard/seating';
import './campaign_dialogs.css';

/**
 * The setup preview of a campaign's next scenario (MC1.6d1, docs/product.md "Campaign screen"):
 * the difficulty and team the log sets it up with, and each investigator's unspent experience to
 * spend on deck upgrades at the table first, as the app leaves deck building to the players.
 * "Start" hands the game to set up to `onStart`; the team's card stats come from the catalog, as
 * in the new game wizard, so it waits for the catalog to load.
 */
export function NextScenarioDialog({
  log,
  entry,
  scenario,
  catalog: catalogSource,
  onStart,
  onCancel,
}: {
  readonly log: CampaignLog;
  readonly entry: CampaignEntry | undefined;
  readonly scenario: ScenarioEntry;
  readonly catalog: CatalogSource;
  readonly onStart: (start: Omit<NextScenarioStart, 'campaignId'>) => Promise<void>;
  readonly onCancel: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const catalog = useCatalog(catalogSource);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const scenarioName = t(scenario.nameKey);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function start() {
    if (catalog.status !== 'ready') return;
    const cards = chosenInvestigators(
      catalog.catalog.investigators,
      log.investigators.map(({ code }) => code),
    );
    setBusy(true);
    setFailed(false);
    onStart({
      title: [scenarioName, ...log.investigators.map(({ name }) => name)].join(' – '),
      ctx: {
        cards: cardDbWith(scenario.cards, cards.map(investigatorCardStats)),
        scenario: scenario.definition,
      },
      seed: drawSeed(),
    })
      .catch((error: unknown) => {
        console.warn('Could not set the next scenario up.', error);
        setFailed(true);
      })
      .finally(() => setBusy(false));
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
              {log.investigators.map(({ code, name }) => (
                <li key={code}>{name}</li>
              ))}
            </ol>
          </dd>
        </dl>
        <section aria-labelledby="next-scenario-upgrades">
          <h3 id="next-scenario-upgrades">{t('nextScenario.upgrades')}</h3>
          <p>{t('nextScenario.spendXp')}</p>
          <ul>
            {log.investigators.map(({ code, name, xpEarned, xpSpent }) => (
              <li key={code}>{t('nextScenario.unspentXp', { name, count: xpEarned - xpSpent })}</li>
            ))}
          </ul>
        </section>
        {catalog.status === 'loading' && <p>{t('wizard.loadingCatalog')}</p>}
        {catalog.status === 'failed' && <p role="alert">{t('wizard.catalogFailed')}</p>}
        {failed && <p role="alert">{t('nextScenario.failed')}</p>}
        <footer>
          <button type="button" onClick={onCancel}>
            {t('games.cancel')}
          </button>
          <button type="submit" disabled={busy || catalog.status !== 'ready'}>
            {t('wizard.start')}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

/** A new game's seed; the engine never reads randomness itself, so it is drawn at the edge. */
function drawSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
