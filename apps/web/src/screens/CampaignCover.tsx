import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import type { CampaignSummary, GameSummary } from '@arkham/engine';
import { findCampaign, findScenario } from '../scenarios/scenarioCatalog';
import { CoverMenu } from './CoverMenu';
import { campaignStanding } from './shelf';

/**
 * One campaign on the home shelf (MD.3b), its scenario games included: the campaign's name, the
 * players' title for it in hand, the team, where it stands, and one way on. A chapter under way continues
 * its game, a chapter without one is set up from the log, and a campaign that is over (or waits
 * for its ending) opens its log, which stays readable. While a chapter is open, the log is in
 * the ⋮ menu instead.
 */
export function CampaignCover({
  campaign,
  games,
}: {
  readonly campaign: CampaignSummary;
  /** The campaign's scenario games, newest first (`ShelfEntry`). */
  readonly games: readonly GameSummary[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const entry = findCampaign(campaign.definitionId);
  const standing = campaignStanding(campaign, games, entry?.definition.scenarios ?? []);
  const log = `/campaign/${campaign.campaignId}`;
  const scenarioName = (id: GameSummary['scenarioId']) => {
    const scenario = findScenario(id);
    return scenario ? t(scenario.nameKey) : id;
  };

  return (
    <li>
      <hgroup>
        <p>
          {t('home.campaignKicker', {
            difficulty: t(`wizard.difficulties.${campaign.difficulty}`),
          })}
        </p>
        <h2>{entry ? t(entry.nameKey) : campaign.title}</h2>
        <p>{campaign.title}</p>
      </hgroup>
      <p>{campaign.investigators.map((i) => i.name).join(', ')}</p>
      {standing.kind === 'over' && <p>{t(`campaignList.result.${standing.result}`)}</p>}
      {standing.kind === 'ending' && <p>{t('home.ending')}</p>}
      {(standing.kind === 'playing' || standing.kind === 'setUp') && (
        <p>
          {t('home.chapter', { n: standing.chapter, scenario: scenarioName(standing.scenarioId) })}
        </p>
      )}
      {standing.kind === 'playing' && (
        <p>
          {t('games.roundPhase', {
            round: standing.game.round,
            phase: t(`games.phases.${standing.game.phase}`),
          })}
        </p>
      )}
      <footer>
        {standing.kind === 'playing' && (
          <Link to={`/game/${standing.game.gameId}`}>{t('home.continue')}</Link>
        )}
        {standing.kind === 'setUp' && (
          <Link to={log}>{t('home.setUp', { n: standing.chapter })}</Link>
        )}
        {(standing.kind === 'over' || standing.kind === 'ending') && (
          <Link to={log}>{t('campaignList.readLog')}</Link>
        )}
        {(standing.kind === 'playing' || standing.kind === 'setUp') && (
          <CoverMenu
            title={campaign.title}
            actions={[{ label: t('campaignList.readLog'), onSelect: () => void navigate(log) }]}
          />
        )}
      </footer>
    </li>
  );
}
