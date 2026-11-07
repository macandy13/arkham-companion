import { useState } from 'react';
import { applySettings } from './applySettings';
import { loadSettings, saveSettings, type Settings } from './settings';

/**
 * The device's settings for a screen that changes them (Settings, Collection): each change is
 * saved and applied at once, so there is nothing to confirm and leaving the screen loses nothing.
 */
export function useSettings(): [Settings, (changes: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  function update(changes: Partial<Settings>) {
    const next = { ...settings, ...changes };
    setSettings(next);
    saveSettings(next);
    applySettings(next);
  }
  return [settings, update];
}
