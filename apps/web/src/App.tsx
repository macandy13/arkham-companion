import { useTranslation } from 'react-i18next';
import { HashRouter, NavLink, Outlet, Route, Routes } from 'react-router';
import type { StoreApi } from 'zustand/vanilla';
import { useCatalog, type CatalogSource } from './catalog/useCatalog';
import { GameExportButton } from './screens/GameExportButton';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { NewGameScreen } from './screens/NewGameScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import type { AppState } from './state/appStore';
import './styles/tokens.css';
import './styles/base.css';
import './screens/layout.css';

/** Props shared by `App` and `AppRoutes`. */
interface AppProps {
  store: StoreApi<AppState>;
  /** Loads the investigator catalog for the wizard and the settings pack list. */
  catalog: CatalogSource;
}

/**
 * Screen routes inside a shared layout (product.md "UI concept"). Separate from `App` so tests
 * can mount it in a `MemoryRouter`.
 */
export function AppRoutes({ store, catalog }: AppProps) {
  return (
    <Routes>
      <Route element={<Layout store={store} />}>
        <Route index element={<HomeScreen store={store} />} />
        <Route path="new" element={<NewGameScreen store={store} catalog={catalog} />} />
        <Route path="game/:id" element={<GameScreen store={store} />} />
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
 * Page frame shared by all screens: the title bar (app title, the play screen's export, settings)
 * plus the active screen.
 */
function Layout({ store }: { store: StoreApi<AppState> }) {
  const { t } = useTranslation();
  return (
    <div id="app">
      <header>
        <NavLink to="/" end>
          {t('app.title')}
        </NavLink>
        <nav aria-label={t('nav.label')}>
          <GameExportButton store={store} />
          <NavLink to="/settings">{t('settings.title')}</NavLink>
        </nav>
      </header>
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
