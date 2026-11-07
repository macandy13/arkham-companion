import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AppMark } from '../brand/AppMark';
import { LoadGameLabel } from './LoadGameLabel';
import './welcome.css';

/** Props of `WelcomePage`. */
interface WelcomePageProps {
  /** Imports a saved game the player picked, as home's own "Load a saved game" does. */
  readonly onLoad: (file: File) => void;
}

/**
 * Home while the shelf is empty (MD.4c, design language "Screens"): a title page of the guide's
 * paper with the app mark, the name, what the app does and what stays on the table, the two ways
 * in as rows, loading a saved game and the fan notice. Once a game is stored, home shows its
 * title on the table and the shelf instead.
 */
export function WelcomePage({ onLoad }: WelcomePageProps) {
  const { t } = useTranslation();
  return (
    <article id="welcome">
      <AppMark />
      <hgroup>
        <h1>{t('app.title')}</h1>
        <p>{t('home.tagline')}</p>
      </hgroup>
      <p>{t('home.welcome.intro')}</p>
      <nav aria-label={t('home.start')}>
        <Link to="/new?mode=campaign" data-way="campaign">
          {t('home.newCampaign')}
          <small>{t('home.welcome.campaignWhy')}</small>
        </Link>
        <Link to="/new?mode=quick" data-way="quick">
          {t('home.oneScenario')}
          <small>{t('home.welcome.quickWhy')}</small>
        </Link>
        <LoadGameLabel onLoad={onLoad} />
      </nav>
      <footer>
        <p>{t('settings.unofficial')}</p>
      </footer>
    </article>
  );
}
