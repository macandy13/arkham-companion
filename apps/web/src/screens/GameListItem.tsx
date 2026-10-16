import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { GameSummary } from '@arkham/engine';
import { ConfirmDialog } from './ConfirmDialog';

interface GameListItemProps {
  readonly game: GameSummary;
  /** Fallback title for games saved without one. */
  readonly untitledLabel: string;
  readonly onRename: (title: string) => void;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
}

/** One saved game on the home screen: progress summary plus resume, rename, duplicate and delete. */
export function GameListItem({
  game,
  untitledLabel,
  onRename,
  onDuplicate,
  onDelete,
}: GameListItemProps) {
  const { t, i18n } = useTranslation();
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const title = game.title || untitledLabel;

  function submitRename(form: HTMLFormElement) {
    const name = new FormData(form).get('title');
    if (typeof name === 'string' && name.trim()) onRename(name.trim());
    setRenaming(false);
  }

  return (
    <li>
      {renaming ? (
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
          <button type="submit">{t('games.save')}</button>
          <button type="button" onClick={() => setRenaming(false)}>
            {t('games.cancel')}
          </button>
        </form>
      ) : (
        <h2>
          <Link to={`/game/${game.gameId}`}>{title}</Link>
        </h2>
      )}
      <dl>
        <dt>{t('games.scenario')}</dt>
        <dd>{game.scenarioId || t('games.notStarted')}</dd>
        <dt>{t('games.investigators')}</dt>
        <dd>{game.investigators.map((i) => i.name).join(', ') || t('games.noInvestigators')}</dd>
        <dt>{t('games.progress')}</dt>
        <dd>
          {t('games.roundPhase', { round: game.round, phase: t(`games.phases.${game.phase}`) })}
        </dd>
        <dt>{t('games.lastPlayed')}</dt>
        <dd>
          <time dateTime={new Date(game.updatedAt).toISOString()}>
            {new Date(game.updatedAt).toLocaleString(i18n.resolvedLanguage)}
          </time>
        </dd>
      </dl>
      <nav aria-label={t('games.actions', { title })}>
        <Link to={`/game/${game.gameId}`}>{t('games.resume')}</Link>
        <button type="button" onClick={() => setRenaming(true)}>
          {t('games.rename')}
        </button>
        <button type="button" onClick={onDuplicate}>
          {t('games.duplicate')}
        </button>
        <button type="button" onClick={() => setConfirmingDelete(true)}>
          {t('games.delete')}
        </button>
      </nav>
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
