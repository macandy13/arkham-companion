import { useTranslation } from 'react-i18next';

/**
 * The alert of a screen whose catalog could not be loaded (`useCatalog`'s `failed` state), with
 * the button that loads it again, so the players need not leave the screen to try once more.
 */
export function CatalogFailed({ retry }: { retry: () => void }) {
  const { t } = useTranslation();
  return (
    <p role="alert">
      {t('wizard.catalogFailed')}{' '}
      <button type="button" onClick={retry}>
        {t('wizard.retry')}
      </button>
    </p>
  );
}
