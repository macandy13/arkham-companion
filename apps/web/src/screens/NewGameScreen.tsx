import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { StoreApi } from 'zustand/vanilla';
import { useCatalog, type CatalogSource } from '../catalog/useCatalog';
import { InvestigatorPicker } from '../picker/InvestigatorPicker';
import { loadSettings } from '../settings/settings';
import type { AppState } from '../state/appStore';
import { seatInvestigators } from '../wizard/seating';
import { SetupStep } from '../wizard/SetupStep';
import { SummaryStep } from '../wizard/SummaryStep';
import {
  chosenScenario,
  clearChoices,
  loadChoices,
  parseMode,
  parseStep,
  saveChoices,
  WIZARD_STEPS,
  type WizardChoices,
  type WizardMode,
  type WizardStep,
} from '../wizard/wizardState';
import '../wizard/wizard.css';

interface NewGameScreenProps {
  readonly store: StoreApi<AppState>;
  readonly catalog: CatalogSource;
}

/**
 * Route `/new`: without a `mode` it offers the two entry points, with `?mode=campaign|quick`
 * it runs the wizard (architecture §11). The step is in the URL (`&step=…`), so browser back
 * and forward walk the steps while the choices live in sessionStorage.
 */
export function NewGameScreen({ store, catalog }: NewGameScreenProps) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const mode = parseMode(params.get('mode'));

  if (!mode) {
    return (
      <>
        <h1>{t('games.new')}</h1>
        <nav aria-label={t('games.new')}>
          <Link to="/new?mode=campaign">{t('games.newCampaign')}</Link>
          <Link to="/new?mode=quick">{t('games.quickGame')}</Link>
        </nav>
      </>
    );
  }
  return (
    <Wizard
      key={mode}
      store={store}
      catalogSource={catalog}
      mode={mode}
      step={parseStep(params.get('step'))}
    />
  );
}

interface WizardProps {
  readonly store: StoreApi<AppState>;
  readonly catalogSource: CatalogSource;
  readonly mode: WizardMode;
  readonly step: WizardStep;
}

function Wizard({ store, catalogSource, mode, step }: WizardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [choices, setChoices] = useState(() => loadChoices(mode));
  const [startFailed, setStartFailed] = useState(false);
  const catalog = useCatalog(catalogSource);
  const scenario = chosenScenario(choices);
  const investigators =
    catalog.status === 'ready'
      ? seatInvestigators(catalog.catalog.investigators, choices.seats)
      : [];

  function update(changes: Partial<WizardChoices>) {
    const next = { ...choices, ...changes };
    setChoices(next);
    saveChoices(next);
  }

  function goTo(target: WizardStep) {
    void navigate({ search: `?mode=${mode}&step=${target}` });
  }

  async function start() {
    if (!scenario) return;
    setStartFailed(false);
    try {
      const gameId = await store.getState().startScenario({
        title: [t(scenario.nameKey), ...investigators.map((i) => i.name)].join(' – '),
        ctx: { cards: scenario.cards },
        definition: scenario.definition,
        difficulty: choices.difficulty,
        // The engine never reads randomness itself, so the seed is drawn at the edge.
        seed: Math.floor(Math.random() * 2 ** 31),
        investigators,
      });
      clearChoices();
      await navigate(`/game/${gameId}`);
    } catch (error) {
      console.warn('Could not start the game.', error);
      setStartFailed(true);
    }
  }

  const index = WIZARD_STEPS.indexOf(step);
  const previous = WIZARD_STEPS[index - 1];
  const next = WIZARD_STEPS[index + 1];
  const canContinue = step === 'setup' ? scenario !== undefined : investigators.length > 0;

  return (
    <>
      <h1>{t(mode === 'campaign' ? 'games.newCampaign' : 'games.quickGame')}</h1>
      <ol aria-label={t('wizard.steps.label')}>
        {WIZARD_STEPS.map((name) => (
          <li key={name} aria-current={name === step ? 'step' : undefined}>
            {t(`wizard.steps.${name}`)}
          </li>
        ))}
      </ol>
      <section id="wizard" aria-label={t(`wizard.steps.${step}`)}>
        {step === 'setup' && <SetupStep choices={choices} onChange={update} />}
        {step !== 'setup' && catalog.status === 'loading' && <p>{t('wizard.loadingCatalog')}</p>}
        {step !== 'setup' && catalog.status === 'failed' && (
          <p role="alert">{t('wizard.catalogFailed')}</p>
        )}
        {step === 'investigators' && catalog.status === 'ready' && (
          <InvestigatorPicker
            catalog={catalog.catalog}
            seats={choices.seats}
            onSeatsChange={(seats) => update({ seats })}
            ownedPacks={ownedPacks()}
          />
        )}
        {step === 'summary' && catalog.status === 'ready' && (
          <SummaryStep choices={choices} investigators={investigators} />
        )}
        {startFailed && <p role="alert">{t('wizard.startFailed')}</p>}
      </section>
      <footer>
        {previous && <button onClick={() => goTo(previous)}>{t('wizard.back')}</button>}
        {next && (
          <button disabled={!canContinue} onClick={() => goTo(next)}>
            {t('wizard.next')}
          </button>
        )}
        {!next && (
          <button disabled={!canContinue} onClick={() => void start()}>
            {t('wizard.start')}
          </button>
        )}
      </footer>
    </>
  );
}

/** Owned packs from the settings; `undefined` while none are set so the picker hides "my collection". */
function ownedPacks(): ReadonlySet<string> | undefined {
  const owned = loadSettings().ownedPacks;
  return owned.length > 0 ? new Set(owned) : undefined;
}
