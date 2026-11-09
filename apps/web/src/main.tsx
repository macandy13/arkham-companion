import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadCatalog } from './catalog/loadCatalog';
import { sharedCatalog } from './catalog/useCatalog';
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

/** Read on every use: the card language can change in Settings while the app runs. */
const cardLanguage = () => loadSettings().cardLanguage;
const catalog = sharedCatalog((language) => loadCatalog(database, language), cardLanguage);

/**
 * The start-up waits for the saved games and for card data to be at hand: the cached catalog
 * when there is one, so a start at the table never waits for the network (the screens refresh
 * it), else the first download. Reading the cached catalog only to see that it is there costs
 * one IndexedDB read, which keeps the store's interface as it is.
 */
const startup: StartupTasks = {
  games: () => store.getState().refresh(),
  cards: async () => (await database.getCatalog(cardLanguage())) ?? catalog(),
};

void initI18n(settings.uiLanguage).then(() => {
  applySettings(settings);
  createRoot(root).render(
    <StrictMode>
      <App store={store} catalog={catalog} startup={startup} />
    </StrictMode>,
  );
});
