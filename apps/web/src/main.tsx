import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initI18n } from './i18n';
import { loadCatalog } from './catalog/loadCatalog';
import { IndexedDbStore } from './storage/IndexedDbStore';
import { createAppStore } from './state/appStore';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

const database = new IndexedDbStore();
const store = createAppStore(database, (lang) => loadCatalog(database, lang));

void initI18n().then(() => {
  createRoot(root).render(
    <StrictMode>
      <App store={store} />
    </StrictMode>,
  );
});
