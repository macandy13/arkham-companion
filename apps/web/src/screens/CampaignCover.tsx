import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import type { CampaignSummary, GameSummary } from '@arkham/engine';
import { findCampaign, findScenario } from '../scenarios/scenarioCatalog';
import { campaignKeyArt } from '../catalog/campaignKeyArt';
import { CoverArt } from './CoverArt';
import { ConfirmDialog } from './ConfirmDialog';
import { CoverMenu } from './CoverMenu';
import { CoverRename } from './CoverRename';
import { campaignArtScenario, campaignStanding } from './shelf';
import { TeamPortraits, type PortraitImages } from './TeamPortraits';

/**
 * One campaign on the home shelf (MD.3b), its scenario games included: its box's key art over the
 * art of the chapter at hand (`CoverArt`), the campaign's name, the players' title for it in hand,
 * where it stands, the team's portraits, and one way on. A chapter under way continues its game, a chapter without one
 * is set up from the log, and a campaign that is over (or waits for its ending) opens its log,
 * which stays readable. While a chapter is open, the log is in the ⋮ menu instead. The ⋮ menu also
 * renames the campaign, exports it with its games, and deletes it with them, after a question.
 */
export function CampaignCover({
  campaign,
  games,
  images,
  lastPlayed,
  onRename,
  onExport,
  onDelete,
}: {
  readonly campaign: CampaignSummary;
  /** The campaign's scenario games, newest first (`ShelfEntry`). */
  readonly games: readonly GameSummary[];
  /** Where the team's card pictures are, for their portraits. */
  readonly images: PortraitImages;
  /** Whether this is the cover played last, which wears the ribbon and the brass button. */
  readonly lastPlayed: boolean;
  readonly onRename: (title: string) => void;
  /** Downloads the campaign's export, its games included. */
  readonly onExport: () => void;
  /** Deletes the campaign with its games, once the players confirmed it. */
  readonly onDelete: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const entry = findCampaign(campaign.definitionId);
  const standing = campaignStanding(campaign, games, entry?.definition.scenarios ?? []);
  const log = `/campaign/${campaign.campaignId}`;
  const primary = lastPlayed || undefined;
  const artScenario = campaignArtScenario(campaign, standing, entry?.definition.scenarios ?? []);
  const scenarioName = (id: GameSummary['scenarioId']) => {
    const scenario = findScenario(id);
    return scenario ? t(scenario.nameKey) : id;
  };

  return (
    <li>
      {lastPlayed && <p data-ribbon>{t('home.lastPlayed')}</p>}
      <CoverArt scenarioId={artScenario} keyArt={campaignKeyArt(campaign.definitionId)} />
      <hgroup>
        <p>
          {t('home.campaignKicker', {
            difficulty: t(`wizard.difficulties.${campaign.difficulty}`),
          })}
        </p>
        <h2>{entry ? t(entry.nameKey) : campaign.title}</h2>
        {!renaming && <p>{campaign.title}</p>}
      </hgroup>
      {renaming && (
        <CoverRename
          title={campaign.title}
          onRename={onRename}
          onClose={() => setRenaming(false)}
        />
      )}
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
      <TeamPortraits team={campaign.investigators} images={images} />
      <footer>
        {standing.kind === 'playing' && (
          <Link to={`/game/${standing.game.gameId}`} data-primary={primary}>
            {t('home.continue')}
          </Link>
        )}
        {standing.kind === 'setUp' && (
          <Link to={log} data-primary={primary}>
            {t('home.setUp', { n: standing.chapter })}
          </Link>
        )}
        {(standing.kind === 'over' || standing.kind === 'ending') && (
          <Link to={log} data-primary={primary}>
            {t('campaignList.readLog')}
          </Link>
        )}
        <CoverMenu
          title={campaign.title}
          actions={[
            ...(standing.kind === 'playing' || standing.kind === 'setUp'
              ? [
                  {
                    label: t('campaignList.readLog'),
                    icon: 'campaign-log' as const,
                    onSelect: () => void navigate(log),
                  },
                ]
              : []),
            { label: t('games.rename'), icon: 'rename', onSelect: () => setRenaming(true) },
            { label: t('games.export'), icon: 'export', onSelect: onExport },
            { label: t('games.delete'), icon: 'delete', onSelect: () => setConfirmingDelete(true) },
          ]}
        />
      </footer>
      {confirmingDelete && (
        <ConfirmDialog
          title={t('games.deleteTitle', { title: campaign.title })}
          confirmLabel={t('games.delete')}
          onConfirm={onDelete}
          onCancel={() => setConfirmingDelete(false)}
        >
          <p>{t('campaignList.deleteWarning')}</p>
        </ConfirmDialog>
      )}
    </li>
  );
}
