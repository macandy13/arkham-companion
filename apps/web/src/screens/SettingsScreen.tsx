import { CARD_LANGUAGES } from '@arkham/carddata';
import type { PackDef } from '@arkham/carddata';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { sortedPacks } from '../picker/pickerLogic';
import { campaignCatalog } from '../scenarios/scenarioCatalog';
import {
  CARD_THEMES,
  CHAOS_DRAWS,
  ENEMY_TOKEN_FACES,
  TABLE_SKINS,
  THEMES,
  TOKEN_SETS,
  UI_LANGUAGES,
  type Settings,
} from '../settings/settings';
import { useSettings } from '../settings/useSettings';
import { GAME_TOKEN_KINDS, GameToken } from '../tokens/GameToken';
import { useAppBar } from './AppBar';
import './settings.css';

interface SettingsScreenProps {
  /** Packs of the card catalog, to name the owned ones; empty until the catalog is loaded. */
  readonly packs?: readonly PackDef[];
}

/**
 * Route `/settings` (MD.3c), written like a form of the campaign guide: one row per subject, its
 * label in a column of spaced capitals and its fields as written lines. The collection is one line
 * that opens its own page (`CollectionScreen`); the table is picked by its playmat, its light is a
 * segmented choice, the token set by a row of its tokens, and who draws the chaos tokens a
 * segmented choice too. Every change is saved at once (`useSettings`). It ends with the notice that the app is an unofficial
 * fan project, with the publisher's copyright credit, which the fan content policy requires for
 * using the game's names; card art is never bundled, only fetched from ArkhamDB on the device.
 */
export function SettingsScreen({ packs = [] }: SettingsScreenProps) {
  const { t, i18n } = useTranslation();
  const [settings, update] = useSettings();
  useAppBar({ title: t('settings.title'), subtitle: t('appBar.settings'), up: '/' });
  const owned = sortedPacks(packs).filter((pack) => settings.ownedPacks.includes(pack.code));
  const ownedCampaigns = campaignCatalog.filter((campaign) =>
    campaign.packCodes.some((code) => settings.ownedPacks.includes(code)),
  );

  return (
    <>
      <h1>{t('settings.title')}</h1>
      <form id="settings">
        <section aria-labelledby="settings-collection">
          <h2 id="settings-collection">{t('settings.collection')}</h2>
          <Link to="/settings/collection">
            {owned.length > 0
              ? owned.map((pack) => pack.name).join(', ')
              : t('settings.nothingOwned')}
            <span>
              {t('settings.campaignsOwned', {
                count: campaignCatalog.length,
                owned: ownedCampaigns.length,
              })}
            </span>
          </Link>
          <p>{t('settings.collectionNote')}</p>
        </section>
        <section aria-labelledby="settings-languages">
          <h2 id="settings-languages">{t('settings.languagesTitle')}</h2>
          <label>
            {t('settings.cardLanguage')}
            <select
              value={settings.cardLanguage}
              onChange={(e) => update({ cardLanguage: e.target.value as Settings['cardLanguage'] })}
            >
              {CARD_LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {t(`settings.languages.${code}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('settings.uiLanguage')}
            <select
              value={settings.uiLanguage ?? i18n.resolvedLanguage}
              onChange={(e) => update({ uiLanguage: e.target.value as Settings['uiLanguage'] })}
            >
              {UI_LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {t(`settings.languages.${code}`)}
                </option>
              ))}
            </select>
          </label>
        </section>
        <section aria-labelledby="settings-table">
          <h2 id="settings-table">{t('settings.table')}</h2>
          <fieldset aria-label={t('settings.tableSkin')} data-picks>
            {TABLE_SKINS.map((tableSkin) => (
              <label key={tableSkin} data-skin={tableSkin}>
                <input
                  type="radio"
                  name="tableSkin"
                  checked={settings.tableSkin === tableSkin}
                  onChange={() => update({ tableSkin })}
                />
                {t(`settings.tableSkins.${tableSkin}`)}
              </label>
            ))}
          </fieldset>
          <fieldset aria-label={t('settings.theme')} data-segmented>
            {THEMES.map((theme) => (
              <label key={theme}>
                <input
                  type="radio"
                  name="theme"
                  checked={settings.theme === theme}
                  onChange={() => update({ theme })}
                />
                {t(`settings.themes.${theme}`)}
              </label>
            ))}
          </fieldset>
        </section>
        <section aria-labelledby="settings-tokens">
          <h2 id="settings-tokens">{t('settings.tokens')}</h2>
          <fieldset aria-label={t('settings.tokenSet')} data-picks>
            {TOKEN_SETS.map((tokenSet) => (
              <label key={tokenSet} data-token-set={tokenSet}>
                <input
                  type="radio"
                  name="tokenSet"
                  checked={settings.tokenSet === tokenSet}
                  onChange={() => update({ tokenSet })}
                />
                <span>
                  {GAME_TOKEN_KINDS.map((kind) => (
                    <GameToken key={kind} kind={kind} />
                  ))}
                </span>
                {t(`settings.tokenSets.${tokenSet}`)}
              </label>
            ))}
          </fieldset>
        </section>
        <section aria-labelledby="settings-chaos-bag">
          <h2 id="settings-chaos-bag">{t('settings.chaosBag')}</h2>
          <fieldset aria-label={t('settings.chaosDraw')} data-segmented>
            {CHAOS_DRAWS.map((chaosDraw) => (
              <label key={chaosDraw}>
                <input
                  type="radio"
                  name="chaosDraw"
                  checked={settings.chaosDraw === chaosDraw}
                  onChange={() => update({ chaosDraw })}
                />
                {t(`settings.chaosDraws.${chaosDraw}`)}
              </label>
            ))}
          </fieldset>
          <p>{t('settings.chaosDrawNote')}</p>
        </section>
        <section aria-labelledby="settings-cards">
          <h2 id="settings-cards">{t('settings.cards')}</h2>
          <label>
            {t('settings.cardTheme')}
            <select
              value={settings.cardTheme}
              onChange={(e) => update({ cardTheme: e.target.value as Settings['cardTheme'] })}
            >
              {CARD_THEMES.map((theme) => (
                <option key={theme} value={theme}>
                  {t(`settings.cardThemes.${theme}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('settings.enemyTokens')}
            <select
              value={settings.enemyTokens}
              onChange={(e) => update({ enemyTokens: e.target.value as Settings['enemyTokens'] })}
            >
              {ENEMY_TOKEN_FACES.map((face) => (
                <option key={face} value={face}>
                  {t(`settings.enemyTokenFaces.${face}`)}
                </option>
              ))}
            </select>
          </label>
        </section>
      </form>
      <section aria-labelledby="settings-about">
        <h2 id="settings-about">{t('settings.about')}</h2>
        <p>{t('settings.unofficial')}</p>
        <p>{t('settings.copyright')}</p>
      </section>
    </>
  );
}
