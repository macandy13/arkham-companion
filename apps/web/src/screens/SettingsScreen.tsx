import { useTranslation } from 'react-i18next';

/** Route `/settings`: placeholder; the collection and language settings arrive with later M2 tasks. */
export function SettingsScreen() {
  const { t } = useTranslation();
  return (
    <>
      <h1>{t('settings.title')}</h1>
      <p>{t('settings.placeholder')}</p>
    </>
  );
}
