import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import {
  campaign,
  campaignId as toCampaignId,
  type CampaignId,
  type CampaignInvestigator,
  type CampaignLog,
  type GameSummary,
  type InterludeDefinition,
  type PlayedScenario,
  type ScenarioOutcome,
} from '@arkham/engine';
import type { CatalogSource } from '../catalog/useCatalog';
import type { AppState } from '../state/appStore';
import {
  findCampaign,
  findScenario,
  resolutionNumber,
  scenarioCardName,
} from '../scenarios/scenarioCatalog';
import { assertNever, range } from '@arkham/util';
import { CampaignSheets } from './CampaignSheets';
import { InterludeDialog } from './InterludeDialog';
import { NextScenarioDialog } from './NextScenarioDialog';
import { ResolutionUndo } from './ResolutionUndo';
import { Tally } from './Tally';
import '@fontsource/felipa/latin-400.css';
import '@fontsource/caveat/latin-500.css';
import '@fontsource/caveat/latin-700.css';
import '@fontsource/libre-caslon-text/latin-700.css';
import './campaign_log.css';

/**
 * Route `/campaign/:id`: the campaign log, drawn after the campaign log sheet of the Core Set
 * (docs/product.md "Campaign screen"): an index card with a column per investigator, a napkin
 * with the scenarios, each played one ticked with its resolution, then the campaign notes and the
 * campaign's own sheets (`CampaignSheets`); once the campaign is over, the card says how it ended
 * (`CampaignOver`). Below them, a link continues the scenario in play, opens the interlude due
 * before the next scenario (`InterludeDialog`) or sets the next one up (`NextScenarioDialog`), and
 * after a resolution or an interlude was written a toast offers to take it back (`ResolutionUndo`).
 */
export function CampaignScreen({
  store,
  catalog,
}: {
  store: StoreApi<AppState>;
  catalog: CatalogSource;
}) {
  const { t } = useTranslation();
  // The route only matches with an `:id` segment; the fallback only satisfies the type.
  const campaignId = toCampaignId(useParams().id ?? '');
  const opened = useStore(store, (s) => s.campaign);
  const written = useStore(store, (s) => s.writtenResolution);

  useEffect(() => {
    void store.getState().openCampaign(campaignId);
  }, [store, campaignId]);

  if (opened === null) return <p role="alert">{t('campaignLog.missing')}</p>;
  if (opened?.campaignId !== campaignId) return <p>{t('campaignLog.loading')}</p>;
  const { log, games } = opened;
  const entry = findCampaign(log.definitionId);

  return (
    <article id="campaign-log" aria-labelledby="campaign-name">
      <section id="campaign-investigators" aria-labelledby="campaign-investigators-title">
        <header>
          <p>{t('campaignLog.title')}</p>
          <h1 id="campaign-name">{entry ? t(entry.nameKey) : opened.title}</h1>
        </header>
        {log.result && <CampaignOver log={log} endedAt={opened.endedAt} />}
        <h2 id="campaign-investigators-title">{t('campaignLog.investigators')}</h2>
        <ol>
          {log.investigators.map((member) => (
            <InvestigatorColumn key={member.code} member={member} />
          ))}
          {range(campaign.MAX_TEAM_SIZE - log.investigators.length).map((blank) => (
            <InvestigatorColumn key={blank} />
          ))}
        </ol>
      </section>
      <ScenarioList log={log} />
      {entry && <CampaignSheets log={log} entry={entry} />}
      <NextStep
        store={store}
        catalog={catalog}
        campaignId={campaignId}
        log={log}
        games={games}
        interlude={opened.interlude}
        storyKey={opened.storyKey}
      />
      {written?.campaignId === campaignId && (
        <ResolutionUndo
          kind={written.kind}
          onUndo={() => store.getState().undoResolution()}
          onDismiss={() => store.getState().dismissWrittenResolution()}
        />
      )}
    </article>
  );
}

/**
 * How the campaign ended (MC1.6f), under the card's head: a stamp with the result (won, lost or
 * survived) and the day it ended, then which ending to read aloud when the last scenario's
 * resolution ended it; a campaign lost earlier, with no investigator left to replace a fallen
 * one, has none to read.
 */
function CampaignOver({
  log,
  endedAt,
}: {
  readonly log: CampaignLog;
  /** Epoch ms of `CampaignEnded` (`OpenCampaign.endedAt`). */
  readonly endedAt: number | undefined;
}) {
  const { t, i18n } = useTranslation();
  const last = log.playedScenarios.at(-1);
  const finished = log.playedScenarios.length === log.scenarioIds.length;
  const scenario = last && findScenario(last.scenarioId);
  const ended = endedAt === undefined ? undefined : new Date(endedAt);
  return (
    <>
      <section id="campaign-result" aria-labelledby="campaign-result-title">
        <h2 id="campaign-result-title">{t('campaignLog.over')}</h2>
        <p>{t(`campaignLog.result.${log.result}`)}</p>
        {ended && (
          <p>
            <time dateTime={ended.toISOString()}>
              {ended.toLocaleDateString(i18n.resolvedLanguage, { dateStyle: 'long' })}
            </time>
          </p>
        )}
      </section>
      {finished && last && scenario && (
        <p id="campaign-ending">{endingToRead(last.outcome, t(scenario.nameKey))}</p>
      )}
    </>
  );

  function endingToRead(outcome: ScenarioOutcome, scenarioName: string): string {
    switch (outcome.kind) {
      case 'resolution':
        return t('campaignLog.readEnding', {
          n: resolutionNumber(outcome.id),
          scenario: scenarioName,
        });
      case 'noResolution':
        return t('campaignLog.readNoResolution', { scenario: scenarioName });
      default:
        return assertNever(outcome);
    }
  }
}

/**
 * One investigator's column of the index card, with the fields of the printed log. Without a
 * `member` only the printed labels show, like a seat on the sheet no one has taken yet.
 */
function InvestigatorColumn({ member }: { readonly member?: CampaignInvestigator }) {
  const { t } = useTranslation();
  const unspentXp = member && member.xpEarned - member.xpSpent;
  return (
    <li>
      <dl>
        <dt>{t('campaignLog.investigator')}</dt>
        <dd>
          {member?.name}
          {member && member.fate !== 'alive' && <em>{t(`campaignLog.fate.${member.fate}`)}</em>}
        </dd>
        <dt>{t('campaignLog.unspentXp')}</dt>
        <dd>
          {member && (
            <>
              <data value={unspentXp}>{unspentXp}</data>
              <small>
                {t('campaignLog.xpTotals', { earned: member.xpEarned, spent: member.xpSpent })}
              </small>
            </>
          )}
        </dd>
        <dt>{t('campaignLog.trauma')}</dt>
        <dd>
          <dl>
            <dt>{t('campaignLog.physical')}</dt>
            <dd>
              {member && (
                <Tally
                  count={member.physicalTrauma}
                  label={t('campaignLog.traumaCount', { count: member.physicalTrauma })}
                />
              )}
            </dd>
            <dt>{t('campaignLog.mental')}</dt>
            <dd>
              {member && (
                <Tally
                  count={member.mentalTrauma}
                  label={t('campaignLog.traumaCount', { count: member.mentalTrauma })}
                />
              )}
            </dd>
          </dl>
        </dd>
        <dt>{t('campaignLog.earnedCards')}</dt>
        <dd>{member?.earnedCards.map(scenarioCardName).join(', ')}</dd>
      </dl>
    </li>
  );
}

/** The napkin: the campaign's scenarios in order, the played ones ticked with their resolution. */
function ScenarioList({ log }: { readonly log: CampaignLog }) {
  const { t } = useTranslation();
  return (
    <section id="campaign-scenarios" aria-labelledby="campaign-scenarios-title">
      <h2 id="campaign-scenarios-title">{t('campaignLog.scenarios')}</h2>
      <ol>
        {log.scenarioIds.map((id, i) => {
          const played = log.playedScenarios.find((p) => p.scenarioId === id);
          const scenario = findScenario(id);
          const isNext = i === log.position && log.result === undefined;
          return (
            <li key={id} aria-current={isNext ? 'step' : undefined}>
              <label>
                <input type="checkbox" checked={played !== undefined} readOnly disabled />
                {scenario ? t(scenario.nameKey) : id}
              </label>
              {played && <span>{outcomeLabel(t, played)}</span>}
              {isNext && <span>{t('campaignLog.next')}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** How the log writes a played scenario's outcome next to its name ("R1", "no resolution"). */
function outcomeLabel(t: ReturnType<typeof useTranslation>['t'], played: PlayedScenario): string {
  const { outcome } = played;
  if (outcome.kind === 'noResolution') return t('campaignLog.noResolution');
  return t('campaignLog.resolution', { n: resolutionNumber(outcome.id) });
}

/**
 * Back to the game of the scenario in play, if the campaign has one that is not over yet;
 * otherwise, once the log has moved on to a scenario without a game, the `interlude` due before
 * it, then the way to set it up.
 */
function NextStep({
  store,
  catalog,
  campaignId,
  log,
  games,
  interlude,
  storyKey,
}: {
  readonly store: StoreApi<AppState>;
  readonly catalog: CatalogSource;
  readonly campaignId: CampaignId;
  readonly log: CampaignLog;
  readonly games: GameSummary[];
  readonly interlude: InterludeDefinition | undefined;
  readonly storyKey: string | undefined;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [settingUp, setSettingUp] = useState(false);
  const scenarioId = log.scenarioIds[log.position];
  const game = games.find((g) => g.scenarioId === scenarioId);
  const scenario = scenarioId && findScenario(scenarioId);
  if (!scenario || log.result) return null;
  const name = t(scenario.nameKey);
  if (game) {
    return (
      <footer>
        <Link to={`/game/${game.gameId}`}>{t('campaignLog.continue', { scenario: name })}</Link>
      </footer>
    );
  }
  if (interlude)
    return <InterludeStep store={store} log={log} interlude={interlude} storyKey={storyKey} />;
  return (
    <footer>
      <button type="button" data-primary onClick={() => setSettingUp(true)}>
        {t('nextScenario.setUp', { scenario: name })}
      </button>
      {settingUp && (
        <NextScenarioDialog
          log={log}
          entry={findCampaign(log.definitionId)}
          scenario={scenario}
          catalog={catalog}
          onCancel={() => setSettingUp(false)}
          onLose={() => store.getState().loseCampaign(campaignId)}
          onStart={async (start) => {
            const gameId = await store.getState().startNextScenario({ ...start, campaignId });
            await navigate(`/game/${gameId}`);
          }}
        />
      )}
    </footer>
  );
}

/** The interlude due before the next scenario: a button that opens it, and its dialog. */
function InterludeStep({
  store,
  log,
  interlude,
  storyKey,
}: {
  readonly store: StoreApi<AppState>;
  readonly log: CampaignLog;
  readonly interlude: InterludeDefinition;
  /** `OpenCampaign.storyKey`. */
  readonly storyKey: string | undefined;
}) {
  const { t } = useTranslation();
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const name = t(`${storyKey}.interludes.${interlude.id}`);
  return (
    <footer>
      <button type="button" data-primary onClick={() => setReading(true)}>
        {t('interlude.begin', { name })}
      </button>
      {reading && (
        <InterludeDialog
          log={log}
          interlude={interlude}
          storyKey={storyKey}
          busy={busy}
          failed={failed}
          onLater={() => setReading(false)}
          onWrite={(confirmed) => {
            setBusy(true);
            setFailed(false);
            store
              .getState()
              .writeInterlude(confirmed)
              .catch((error: unknown) => {
                console.warn('The interlude could not be written into the log.', error);
                setFailed(true);
              })
              .finally(() => setBusy(false));
          }}
        />
      )}
    </footer>
  );
}
