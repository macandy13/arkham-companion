import { useTranslation } from 'react-i18next';
import { HashRouter, NavLink, Outlet, Route, Routes, useMatch } from 'react-router';
import type { StoreApi } from 'zustand/vanilla';
import { CampaignScreen } from './campaign/CampaignScreen';
import { useCatalog, type CatalogSource } from './catalog/useCatalog';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { NewGameScreen } from './screens/NewGameScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import type { AppState } from './state/appStore';
// The playmat's fonts, self-hosted so the PWA has them offline: only the Latin subsets and the
// weights the stylesheets use.
import '@fontsource/im-fell-english-sc/latin-400.css';
import '@fontsource/alegreya-sans/latin-400.css';
import '@fontsource/alegreya-sans/latin-700.css';
import '@fontsource/federant/latin-400.css';
import './styles/tokens.css';
import './styles/base.css';
import './screens/layout.css';

/** Props shared by `App` and `AppRoutes`. */
interface AppProps {
  store: StoreApi<AppState>;
  /** Loads the card catalog: investigators for the wizard, packs for settings, scenario card texts for the game. */
  catalog: CatalogSource;
}

/**
 * Screen routes inside a shared layout (product.md "UI concept"). Separate from `App` so tests
 * can mount it in a `MemoryRouter`.
 */
export function AppRoutes({ store, catalog }: AppProps) {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomeScreen store={store} />} />
        <Route path="new" element={<NewGameScreen store={store} catalog={catalog} />} />
        <Route path="game/:id" element={<GameScreen store={store} catalog={catalog} />} />
        <Route path="campaign/:id" element={<CampaignScreen store={store} />} />
        <Route path="settings" element={<SettingsRoute catalog={catalog} />} />
      </Route>
    </Routes>
  );
}

/** Root component. Hash routing keeps deep links working on static GitHub Pages without server rewrites. */
export function App({ store, catalog }: Partial<AppProps>) {
  if (!store || !catalog) return null;
  return (
    <HashRouter>
      <AppRoutes store={store} catalog={catalog} />
    </HashRouter>
  );
}

/**
 * Page frame shared by all screens: the title bar (app title, settings) plus the active screen.
 * The play screen leaves the title bar out, so the table keeps its height; its status row's menu
 * (`GameStatus`) holds the same links and the game's export.
 */
function Layout() {
  const { t } = useTranslation();
  const playing = useMatch('/game/:id') !== null;
  return (
    <div id="app">
      {!playing && (
        <header>
          <NavLink to="/" end>
            {t('app.title')}
          </NavLink>
          <nav aria-label={t('nav.label')}>
            <NavLink to="/settings">{t('settings.title')}</NavLink>
          </nav>
        </header>
      )}
      <main>
        <Outlet />
      </main>
    </div>
  );
}

/** Settings with the pack list of the card catalog, which stays empty until the catalog has loaded. */
function SettingsRoute({ catalog }: { catalog: CatalogSource }) {
  const state = useCatalog(catalog);
  return <SettingsScreen packs={state.status === 'ready' ? state.catalog.packs : undefined} />;
}
