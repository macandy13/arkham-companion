import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadCatalog } from './catalog/loadCatalog';
import { initI18n } from './i18n';
import { applySettings } from './settings/applySettings';
import { loadSettings } from './settings/settings';
import type { StartupTasks } from './screens/Startup';
import { IndexedDbStore } from './storage/IndexedDbStore';
import { createAppStore } from './state/appStore';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

const database = new IndexedDbStore();
const store = createAppStore(database);

const settings = loadSettings();

const catalog = () => loadCatalog(database, loadSettings().cardLanguage);

/**
 * The start-up waits for the saved games and for card data to be at hand: the cached catalog
 * when there is one, so a start at the table never waits for the network (the screens refresh
 * it), else the first download.
 */
const startup: StartupTasks = {
  games: () => store.getState().refresh(),
  cards: async () => (await database.getCatalog(settings.cardLanguage)) ?? catalog(),
};

void initI18n(settings.uiLanguage).then(() => {
  applySettings(settings);
  createRoot(root).render(
    <StrictMode>
      <App store={store} catalog={catalog} startup={startup} />
    </StrictMode>,
  );
});
