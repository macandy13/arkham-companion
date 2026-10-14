import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initI18n } from './i18n';
import { applySettings } from './settings/applySettings';
import { loadSettings } from './settings/settings';
import { IndexedDbStore } from './storage/IndexedDbStore';
import { createAppStore } from './state/appStore';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

const store = createAppStore(new IndexedDbStore());

const settings = loadSettings();

void initI18n(settings.uiLanguage).then(() => {
  applySettings(settings);
  createRoot(root).render(
    <StrictMode>
      <App store={store} />
    </StrictMode>,
  );
});
