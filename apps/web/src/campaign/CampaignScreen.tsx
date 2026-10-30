import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import {
  campaign,
  campaignId as toCampaignId,
  type CampaignInvestigator,
  type CampaignLog,
  type GameSummary,
  type PlayedScenario,
} from '@arkham/engine';
import type { AppState } from '../state/appStore';
import { findCampaign, findScenario, scenarioCardName } from '../scenarios/scenarioCatalog';
import { range } from '@arkham/util';
import { CampaignSheets } from './CampaignSheets';
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
 * campaign's own sheets (`CampaignSheets`). Below them, a link continues the scenario in play.
 */
export function CampaignScreen({ store }: { store: StoreApi<AppState> }) {
  const { t } = useTranslation();
  // The route only matches with an `:id` segment; the fallback only satisfies the type.
  const campaignId = toCampaignId(useParams().id ?? '');
  const opened = useStore(store, (s) => s.campaign);

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
      <ContinueLink log={log} games={games} />
    </article>
  );
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
  // Resolution ids are numbered like the guide's ("R1"), and the log writes the number.
  return t('campaignLog.resolution', { n: /\d+$/.exec(outcome.id)?.[0] ?? outcome.id });
}

/** Back to the game of the scenario in play, if the campaign has one that is not over yet. */
function ContinueLink({
  log,
  games,
}: {
  readonly log: CampaignLog;
  readonly games: GameSummary[];
}) {
  const { t } = useTranslation();
  const scenarioId = log.scenarioIds[log.position];
  const game = games.find((g) => g.scenarioId === scenarioId);
  const scenario = scenarioId && findScenario(scenarioId);
  if (!game || !scenario || log.result) return null;
  return (
    <footer>
      <Link to={`/game/${game.gameId}`}>
        {t('campaignLog.continue', { scenario: t(scenario.nameKey) })}
      </Link>
    </footer>
  );
}
