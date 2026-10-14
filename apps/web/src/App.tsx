import { useTranslation } from 'react-i18next';
import { HashRouter, NavLink, Outlet, Route, Routes } from 'react-router';
import type { StoreApi } from 'zustand/vanilla';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { NewGameScreen } from './screens/NewGameScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import type { AppState } from './state/appStore';
import './styles/tokens.css';
import './styles/base.css';
import './screens/layout.css';

/**
 * Screen routes inside a shared layout (architecture §11). Separate from `App` so tests
 * can mount it in a `MemoryRouter`.
 */
export function AppRoutes({ store }: { store: StoreApi<AppState> }) {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomeScreen store={store} />} />
        <Route path="new" element={<NewGameScreen store={store} />} />
        <Route path="game/:id" element={<GameScreen store={store} />} />
        <Route path="settings" element={<SettingsScreen />} />
      </Route>
    </Routes>
  );
}

/** Root component. Hash routing keeps deep links working on static GitHub Pages without server rewrites. */
export function App({ store }: { store?: StoreApi<AppState> }) {
  if (!store) return null;
  return (
    <HashRouter>
      <AppRoutes store={store} />
    </HashRouter>
  );
}

/** Page frame shared by all screens: navigation header plus the active screen. */
function Layout() {
  const { t } = useTranslation();
  return (
    <div id="app">
      <header>
        <NavLink to="/" end>
          {t('app.title')}
        </NavLink>
        <nav aria-label={t('nav.label')}>
          <NavLink to="/settings">{t('settings.title')}</NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
