import { useTranslation } from 'react-i18next';

/**
 * The form a home cover shows in place of its players' title while they rename it (the ⋮ menu's
 * Rename, MD.3b): the title to edit, Cancel and Save. A blank title saves nothing.
 */
export function CoverRename({
  title,
  onRename,
  onClose,
}: {
  /** The title as it stands. */
  readonly title: string;
  readonly onRename: (title: string) => void;
  /** Ends renaming, after a save or a cancel. */
  readonly onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const name = new FormData(e.currentTarget).get('title');
        if (typeof name === 'string' && name.trim()) onRename(name.trim());
        onClose();
      }}
    >
      <label>
        {t('games.name')}
        <input name="title" defaultValue={title} required />
      </label>
      <button type="button" onClick={onClose}>
        {t('games.cancel')}
      </button>
      <button type="submit">{t('games.save')}</button>
    </form>
  );
}
