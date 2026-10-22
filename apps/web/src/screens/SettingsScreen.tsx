import type { PackDef } from '@arkham/carddata';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cyclePositions, sortedPacks } from '../picker/pickerLogic';
import { applySettings } from '../settings/applySettings';
import {
  CARD_LANGUAGES,
  loadSettings,
  saveSettings,
  THEMES,
  UI_LANGUAGES,
  type Settings,
} from '../settings/settings';
import './settings.css';

interface SettingsScreenProps {
  /** Packs of the card catalog; empty until the catalog is loaded (not wired up before M2.7). */
  readonly packs?: readonly PackDef[];
}

/**
 * Route `/settings`: owned packs, card and UI language and theme, saved on every change, and the
 * notice that the app is an unofficial fan project, with the publisher's copyright credit. The
 * notice is the fan content policy's condition for using the game's names, and the card art the
 * app fetches from ArkhamDB on the player's device.
 */
export function SettingsScreen({ packs = [] }: SettingsScreenProps) {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<Settings>(loadSettings);

  function update(changes: Partial<Settings>) {
    const next = { ...settings, ...changes };
    setSettings(next);
    saveSettings(next);
    applySettings(next);
  }

  function togglePack(code: string, owned: boolean) {
    const others = settings.ownedPacks.filter((c) => c !== code);
    update({ ownedPacks: owned ? [...others, code] : others });
  }

  return (
    <>
      <h1>{t('settings.title')}</h1>
      <form id="settings">
        <section aria-labelledby="settings-collection">
          <h2 id="settings-collection">{t('settings.collection')}</h2>
          {packs.length === 0 ? (
            <p>{t('settings.noPacks')}</p>
          ) : (
            cyclePositions(packs).map((cycle) => (
              <fieldset key={cycle}>
                <legend>{t('picker.cycleNumber', { n: cycle })}</legend>
                {sortedPacks(packs)
                  .filter((pack) => pack.cyclePosition === cycle)
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
            ))
          )}
        </section>
        <section aria-labelledby="settings-preferences">
          <h2 id="settings-preferences">{t('settings.preferences')}</h2>
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
          <label>
            {t('settings.theme')}
            <select
              value={settings.theme}
              onChange={(e) => update({ theme: e.target.value as Settings['theme'] })}
            >
              {THEMES.map((theme) => (
                <option key={theme} value={theme}>
                  {t(`settings.themes.${theme}`)}
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
