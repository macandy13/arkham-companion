import type { PackDef } from '@arkham/carddata';
import { useTranslation } from 'react-i18next';
import { sortedPacks } from '../picker/pickerLogic';
import { campaignCatalog } from '../scenarios/scenarioCatalog';
import { useSettings } from '../settings/useSettings';
import { useAppBar } from './AppBar';
import './settings.css';

/**
 * Route `/settings/collection` (MD.3c): the boxes on the players' shelf, ticked per campaign the
 * app plays, saved on every change. New games offer only what is owned. Settings shows the
 * collection as one line that opens this page.
 */
export function CollectionScreen({
  packs = [],
}: {
  /** Packs of the card catalog; empty until it is loaded. Only the campaigns' own are listed. */
  readonly packs?: readonly PackDef[];
}) {
  const { t } = useTranslation();
  const [settings, update] = useSettings();
  useAppBar({ title: t('settings.collection'), subtitle: t('settings.title'), up: '/settings' });

  function togglePack(code: string, owned: boolean) {
    const others = settings.ownedPacks.filter((c) => c !== code);
    update({ ownedPacks: owned ? [...others, code] : others });
  }

  return (
    <>
      <h1>{t('settings.collectionTitle')}</h1>
      {packs.length === 0 ? (
        <p>{t('settings.noPacks')}</p>
      ) : (
        <form id="collection">
          {campaignCatalog.map((campaign) => (
            <fieldset key={campaign.id}>
              <legend>{t(campaign.nameKey)}</legend>
              {sortedPacks(packs)
                .filter((pack) => campaign.packCodes.includes(pack.code))
                .map((pack) => (
                  <label key={pack.code}>
                    <input
                      type="checkbox"
                      checked={settings.ownedPacks.includes(pack.code)}
                      onChange={(e) => togglePack(pack.code, e.target.checked)}
                    />
                    {pack.name}
                  </label>
                ))}
            </fieldset>
          ))}
        </form>
      )}
      <p>{t('settings.collectionNote')}</p>
    </>
  );
}
