import { useTranslation } from 'react-i18next';
import type { Rejection } from '@arkham/engine';

/**
 * Says why the last action was refused (`OpenGame.rejection`) in the players' words. Codes the
 * screen cannot cause by a tap have no own text and fall back to a general one, so a new engine
 * rejection never shows a raw key. A toast (`data-toast`): a pill with OK as a text link.
 */
export function RejectionToast({
  rejection,
  onDismiss,
}: {
  rejection: Rejection;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();

  return (
    <aside role="alert" data-toast aria-label={t('toast.label')}>
      <p>{t(`rejections.${rejection.code}`, { defaultValue: t('toast.fallback') })}</p>
      <button type="button" onClick={onDismiss}>
        {t('toast.dismiss')}
      </button>
    </aside>
  );
}
