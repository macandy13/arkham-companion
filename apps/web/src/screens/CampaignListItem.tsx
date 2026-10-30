import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { CampaignSummary } from '@arkham/engine';

/** One campaign on the home screen: difficulty, team and how far it got; it resumes at its log. */
export function CampaignListItem({ campaign }: { readonly campaign: CampaignSummary }) {
  const { t, i18n } = useTranslation();
  const resume = `/campaign/${campaign.campaignId}`;

  return (
    <li>
      <h2>
        <Link to={resume}>{campaign.title}</Link>
      </h2>
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
      <nav aria-label={t('games.actions', { title: campaign.title })}>
        <Link to={resume}>{t('games.resume')}</Link>
      </nav>
    </li>
  );
}
