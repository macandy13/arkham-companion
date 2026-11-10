import { useLayoutEffect } from 'react';
import { HashRouter, Outlet, Route, Routes, useLocation, useMatch } from 'react-router';
import type { StoreApi } from 'zustand/vanilla';
import { CampaignScreen } from './campaign/CampaignScreen';
import { useCatalog, type CatalogSource } from './catalog/useCatalog';
import { AppBarFrame } from './screens/AppBar';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { NewGameScreen } from './screens/NewGameScreen';
import { CollectionScreen } from './screens/CollectionScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { Startup, type StartupTasks } from './screens/Startup';
import type { AppState } from './state/appStore';
// The app's fonts, self-hosted so the PWA has them offline: only the Latin subsets and the
// weights the stylesheets use.
import '@fontsource/im-fell-english-sc/latin-400.css';
import '@fontsource/alegreya-sans/latin-400.css';
import '@fontsource/alegreya-sans/latin-700.css';
import '@fontsource/federant/latin-400.css';
import '@fontsource/grenze-gotisch/latin-400.css';
import '@fontsource/libre-caslon-text/latin-400.css';
import '@fontsource/libre-caslon-text/latin-400-italic.css';
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
        <Route index element={<HomeScreen store={store} catalog={catalog} />} />
        <Route path="new" element={<NewGameScreen store={store} catalog={catalog} />} />
        <Route path="game/:id" element={<GameScreen store={store} catalog={catalog} />} />
        <Route path="campaign/:id" element={<CampaignScreen store={store} catalog={catalog} />} />
        <Route path="settings" element={<SettingsRoute catalog={catalog} />} />
        <Route path="settings/collection" element={<CollectionRoute catalog={catalog} />} />
      </Route>
    </Routes>
  );
}

/** Props of `App`: the routes' props and what the app loads before its first screen. */
interface RootProps extends AppProps {
  startup: StartupTasks;
}

/**
 * Root component: the loading screen until the start-up steps have finished, then the routes.
 * Hash routing keeps deep links working on static GitHub Pages without server rewrites.
 */
export function App({ store, catalog, startup }: Partial<RootProps>) {
  if (!store || !catalog || !startup) return null;
  return (
    <Startup tasks={startup}>
      <HashRouter>
        <AppRoutes store={store} catalog={catalog} />
      </HashRouter>
    </Startup>
  );
}

/**
 * Page frame shared by all screens: the app bar (`AppBarFrame`, MD.3a) over the active screen.
 * The play screen leaves the bar out, so the table keeps its height; its status row's menu
 * (`GameStatus`) holds the same links and the game's export. Each screen opens at its top: the
 * page is one document, so without that a screen would open as far down as the last one was
 * scrolled.
 */
function Layout() {
  const playing = useMatch('/game/:id') !== null;
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    document.documentElement.scrollTop = 0;
  }, [pathname]);
  const main = (
    <main>
      <Outlet />
    </main>
  );
  return <div id="app">{playing ? main : <AppBarFrame>{main}</AppBarFrame>}</div>;
}

/** Settings with the pack list of the card catalog, which stays empty until the catalog has loaded. */
function SettingsRoute({ catalog }: { catalog: CatalogSource }) {
  const state = useCatalog(catalog);
  return <SettingsScreen packs={state.status === 'ready' ? state.catalog.packs : undefined} />;
}

/** The collection with the pack list of the card catalog, empty until the catalog has loaded. */
function CollectionRoute({ catalog }: { catalog: CatalogSource }) {
  const state = useCatalog(catalog);
  return <CollectionScreen packs={state.status === 'ready' ? state.catalog.packs : undefined} />;
}
