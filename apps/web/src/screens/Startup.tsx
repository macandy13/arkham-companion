import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AppMark } from '../brand/AppMark';
import { MARK_TICK_COUNT } from '../brand/appMark';
import './startup.css';

/** What the app loads before its first screen, in the order the loading screen lists it. */
export const STARTUP_STEPS = ['games', 'cards'] as const;

/** One step of the start-up: the saved games, or the card data. */
export type StartupStep = (typeof STARTUP_STEPS)[number];

/**
 * The work behind each start-up step (`main.tsx` builds it). A step that fails still ends the
 * start-up, so the app opens offline; the screen that needs it shows its own error.
 */
export type StartupTasks = Readonly<Record<StartupStep, () => Promise<unknown>>>;

/** Props of `Startup`. */
interface StartupProps {
  readonly tasks: StartupTasks;
  /** The app, shown once every step has finished. */
  readonly children: ReactNode;
}

/**
 * Runs the start-up steps once and shows the loading screen (MD.4b) until all of them have
 * finished, then the app.
 */
export function Startup({ tasks, children }: StartupProps) {
  const [finished, setFinished] = useState<ReadonlySet<StartupStep>>(new Set());

  useEffect(() => {
    let current = true;
    for (const step of STARTUP_STEPS) {
      tasks[step]()
        .catch((error: unknown) => console.warn(`Start-up step "${step}" failed.`, error))
        .finally(() => current && setFinished((done) => new Set(done).add(step)));
    }
    return () => {
      current = false;
    };
  }, [tasks]);

  return finished.size < STARTUP_STEPS.length ? <StartupScreen finished={finished} /> : children;
}

/**
 * The loading screen on the table (design language "Screens"): the app mark, whose ring of ticks
 * fills as the steps finish, over the app's name and the steps, each ticked off when done.
 */
export function StartupScreen({ finished }: { readonly finished: ReadonlySet<StartupStep> }) {
  const { t } = useTranslation();
  const lit = Math.round((finished.size / STARTUP_STEPS.length) * MARK_TICK_COUNT);
  return (
    <main id="startup" aria-busy="true">
      <div
        role="progressbar"
        aria-label={t('startup.progress')}
        aria-valuemin={0}
        aria-valuemax={STARTUP_STEPS.length}
        aria-valuenow={finished.size}
      >
        <AppMark lit={lit} />
      </div>
      <h1>{t('app.title')}</h1>
      <p>{t('startup.tagline')}</p>
      <ul aria-label={t('startup.steps')}>
        {STARTUP_STEPS.map((step) => (
          <li key={step} data-done={finished.has(step) || undefined}>
            {t(`startup.step.${step}`)}
          </li>
        ))}
      </ul>
    </main>
  );
}
