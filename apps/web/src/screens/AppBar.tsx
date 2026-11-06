import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation } from 'react-router';
import './app_bar.css';

/**
 * What the app bar shows for the open screen (MD.3a): its name, a line under it, and the screen
 * the back chevron leads up to. Home sets none, so its bar holds only the ⋮ menu.
 */
export interface AppBarContent {
  readonly title: string;
  readonly subtitle?: string;
  /** Route of the screen above this one; the chevron goes there rather than back in history, so a deep link still has a way up. */
  readonly up: string;
}

/** Lets a screen name itself in the app bar the layout draws above it (`useAppBar`). */
const AppBarContext = createContext<(content: AppBarContent | undefined) => void>(() => undefined);

/**
 * Names the open screen in the app bar while it is mounted. The bar sits outside the screen's
 * paper page (`#app > main`), so the screen hands its title up instead of drawing it.
 */
export function useAppBar({ title, subtitle, up }: AppBarContent) {
  const show = useContext(AppBarContext);
  // Before paint, so a screen never shows a frame of the app's title without its chevron.
  useLayoutEffect(() => {
    show({ title, subtitle, up });
    return () => show(undefined);
  }, [show, title, subtitle, up]);
}

/**
 * The bar on the table over every screen outside play (design language "Screens"): a back
 * chevron up to the screen above, the screen's name in the display face with its subtitle, and
 * a ⋮ menu with the app's places. `children` is the screen below, which names itself with
 * `useAppBar`.
 */
export function AppBarFrame({ children }: { readonly children: ReactNode }) {
  const { t } = useTranslation();
  const [content, setContent] = useState<AppBarContent>();
  // A new screen starts with the menu closed, however the players left the last one.
  const { key } = useLocation();
  return (
    <AppBarContext.Provider value={setContent}>
      <header>
        {content && <Link to={content.up} data-icon="back" aria-label={t('appBar.up')} />}
        {/* Home names the app in its own title, so its bar holds only the menu. */}
        <div>
          {content && <p>{content.title}</p>}
          {content?.subtitle && <p>{content.subtitle}</p>}
        </div>
        <AppMenu key={key} />
      </header>
      {children}
    </AppBarContext.Provider>
  );
}

/** The app bar's ⋮ menu: the app's places. */
function AppMenu() {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  return (
    <nav aria-label={t('nav.label')}>
      <button
        type="button"
        data-icon="more"
        aria-label={t('header.menu')}
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      />
      {expanded && (
        <ul>
          <li>
            <NavLink to="/" end>
              {t('appBar.games')}
            </NavLink>
          </li>
          <li>
            <NavLink to="/settings">{t('settings.title')}</NavLink>
          </li>
        </ul>
      )}
    </nav>
  );
}
