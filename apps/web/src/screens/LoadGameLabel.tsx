import { useTranslation } from 'react-i18next';

/**
 * "Load a saved game": a label around a hidden file input, so the way in reads as a pill or a
 * line like the others. Home and its welcome page both offer it; the screen imports the file.
 */
export function LoadGameLabel({ onLoad }: { readonly onLoad: (file: File) => void }) {
  const { t } = useTranslation();
  return (
    <label>
      {t('home.load')}
      <input
        type="file"
        accept=".json,application/json"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          // Cleared, so loading the same file again still fires a change.
          e.currentTarget.value = '';
          if (file) onLoad(file);
        }}
      />
    </label>
  );
}
