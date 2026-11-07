import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { GameSummary } from '@arkham/engine';
import { findScenario } from '../scenarios/scenarioCatalog';
import { ConfirmDialog } from './ConfirmDialog';
import { CoverArt } from './CoverArt';
import { CoverMenu } from './CoverMenu';
import { TeamPortraits, type PortraitImages } from './TeamPortraits';

interface GameCoverProps {
  readonly game: GameSummary;
  /** Fallback title for games saved without one. */
  readonly untitledLabel: string;
  readonly onRename: (title: string) => void;
  readonly onDuplicate: () => void;
  readonly onExport: () => void;
  readonly onDelete: () => void;
  /** Where the team's card pictures are, for their portraits. */
  readonly images: PortraitImages;
  /** Whether this is the cover played last, which wears the ribbon and the brass button. */
  readonly lastPlayed: boolean;
}

/**
 * The name the home screen lists the game at `index` of `games` under when it has no title, numbered
 * from the oldest since the list is newest first. The play screen menu's export names its file with it too,
 * so a game is saved under the same name from both.
 */
export function untitledLabel(t: TFunction, games: readonly GameSummary[], index: number): string {
  return t('games.untitled', { n: games.length - index });
}

/**
 * One game of one scenario on the home shelf (MD.3b): its first agenda's art, its scenario, the players' title for it
 * in hand, the round it stands at, the team's portraits, Continue, and a ⋮ menu to rename, duplicate,
 * export or delete it.
 */
export function GameCover({
  game,
  untitledLabel,
  onRename,
  onDuplicate,
  onExport,
  onDelete,
  images,
  lastPlayed,
}: GameCoverProps) {
  const { t } = useTranslation();
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const title = game.title || untitledLabel;
  const scenario = findScenario(game.scenarioId);

  function submitRename(form: HTMLFormElement) {
    const name = new FormData(form).get('title');
    if (typeof name === 'string' && name.trim()) onRename(name.trim());
    setRenaming(false);
  }

  return (
    <li>
      {lastPlayed && <p data-ribbon>{t('home.lastPlayed')}</p>}
      <CoverArt scenarioId={game.scenarioId} />
      <hgroup>
        <p>{t('home.oneScenario')}</p>
        <h2>{scenario ? t(scenario.nameKey) : t('games.notStarted')}</h2>
        {!renaming && <p>{title}</p>}
      </hgroup>
      {renaming && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitRename(e.currentTarget);
          }}
        >
          <label>
            {t('games.name')}
            <input name="title" defaultValue={game.title} required />
          </label>
          <button type="button" onClick={() => setRenaming(false)}>
            {t('games.cancel')}
          </button>
          <button type="submit">{t('games.save')}</button>
        </form>
      )}
      <p>{t('games.roundPhase', { round: game.round, phase: t(`games.phases.${game.phase}`) })}</p>
      <TeamPortraits team={game.investigators} images={images} />
      <footer>
        <Link to={`/game/${game.gameId}`} data-primary={lastPlayed || undefined}>
          {t('home.continue')}
        </Link>
        <CoverMenu
          title={title}
          actions={[
            { label: t('games.rename'), onSelect: () => setRenaming(true) },
            { label: t('games.duplicate'), onSelect: onDuplicate },
            { label: t('games.export'), onSelect: onExport },
            { label: t('games.delete'), onSelect: () => setConfirmingDelete(true) },
          ]}
        />
      </footer>
      {confirmingDelete && (
        <ConfirmDialog
          title={t('games.deleteTitle', { title })}
          confirmLabel={t('games.delete')}
          onConfirm={onDelete}
          onCancel={() => setConfirmingDelete(false)}
        >
          <p>{t('games.deleteWarning')}</p>
        </ConfirmDialog>
      )}
    </li>
  );
}
