import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { CampaignSummary, GameId } from '@arkham/engine';

interface CampaignListItemProps {
  readonly campaign: CampaignSummary;
  /** The campaign's most recently played game, which "Resume" opens; absent before its first game. */
  readonly latestGameId?: GameId;
}

/** One campaign on the home screen: difficulty, team and how far it got, plus resume. */
export function CampaignListItem({ campaign, latestGameId }: CampaignListItemProps) {
  const { t, i18n } = useTranslation();
  const resume = latestGameId && `/game/${latestGameId}`;

  return (
    <li>
      <h2>{resume ? <Link to={resume}>{campaign.title}</Link> : campaign.title}</h2>
      <dl>
        <dt>{t('wizard.difficulty')}</dt>
        <dd>{t(`wizard.difficulties.${campaign.difficulty}`)}</dd>
        <dt>{t('games.investigators')}</dt>
        <dd>{campaign.investigators.map((i) => i.name).join(', ')}</dd>
        <dt>{t('games.progress')}</dt>
        <dd>
          {campaign.result
            ? t(`campaignList.result.${campaign.result}`)
            : t('campaignList.scenarioOf', {
                // Past the last scenario the log waits for its end to be recorded.
                n: Math.min(campaign.position + 1, campaign.scenarioCount),
                total: campaign.scenarioCount,
              })}
        </dd>
        <dt>{t('games.lastPlayed')}</dt>
        <dd>
          <time dateTime={new Date(campaign.updatedAt).toISOString()}>
            {new Date(campaign.updatedAt).toLocaleString(i18n.resolvedLanguage)}
          </time>
        </dd>
      </dl>
      {resume && (
        <nav aria-label={t('games.actions', { title: campaign.title })}>
          <Link to={resume}>{t('games.resume')}</Link>
        </nav>
      )}
    </li>
  );
}
