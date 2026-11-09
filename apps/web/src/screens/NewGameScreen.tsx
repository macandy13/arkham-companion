import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { StoreApi } from 'zustand/vanilla';
import { cardDbWith, investigatorCardStats } from '@arkham/engine';
import { CatalogFailed } from '../catalog/CatalogFailed';
import { useCatalog, type CatalogSource } from '../catalog/useCatalog';
import { InvestigatorPicker } from '../picker/InvestigatorPicker';
import { loadSettings } from '../settings/settings';
import type { AppState } from '../state/appStore';
import { chosenInvestigators, seatsFor } from '../wizard/seating';
import { SetupStep } from '../wizard/SetupStep';
import { TargetCovers } from '../wizard/TargetCovers';
import { SummaryStep } from '../wizard/SummaryStep';
import { useAppBar } from './AppBar';
import {
  chosenCampaign,
  chosenScenario,
  clearChoices,
  loadChoices,
  offeredTargets,
  parseMode,
  parseStep,
  saveChoices,
  WIZARD_STEPS,
  type WizardChoices,
  type WizardMode,
  type WizardStep,
} from '../wizard/wizardState';
import '../wizard/wizard.css';
import { Spinner } from '../brand/AppMark';

interface NewGameScreenProps {
  readonly store: StoreApi<AppState>;
  readonly catalog: CatalogSource;
}

/**
 * Route `/new`: without a `mode` it offers the two entry points, with `?mode=campaign|quick`
 * it runs the wizard (product.md "UI concept"). The step is in the URL (`&step=…`), so browser back
 * and forward walk the steps while the choices live in sessionStorage.
 */
export function NewGameScreen({ store, catalog }: NewGameScreenProps) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const mode = parseMode(params.get('mode'));
  useAppBar(
    mode
      ? {
          title: t(mode === 'campaign' ? 'games.newCampaign' : 'games.quickGame'),
          subtitle: t(`appBar.${mode}`),
          up: '/new',
        }
      : { title: t('games.new'), subtitle: t('appBar.newGame'), up: '/' },
  );

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
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [choices, setChoices] = useState(() => loadChoices(mode));
  const [startFailed, setStartFailed] = useState(false);
  const catalog = useCatalog(catalogSource);
  const scenario = chosenScenario(choices);
  const investigators =
    catalog.status === 'ready'
      ? chosenInvestigators(catalog.catalog.investigators, choices.seats)
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
    const campaign = chosenCampaign(choices);
    const titled = (nameKey: string) =>
      [t(nameKey), ...investigators.map((investigator) => investigator.name)].join(' – ');
    const start = {
      title: titled(scenario.nameKey),
      ctx: {
        cards: cardDbWith(scenario.cards, investigators.map(investigatorCardStats)),
        scenario: scenario.definition,
      },
      difficulty: choices.difficulty,
      reliance: loadSettings().reliance,
      // The engine never reads randomness itself, so the seed is drawn at the edge.
      seed: Math.floor(Math.random() * 2 ** 31),
      investigators: seatsFor(investigators),
    };
    try {
      const gameId = await (campaign
        ? store.getState().startCampaign({
            ...start,
            definition: campaign.definition,
            campaignTitle: titled(campaign.nameKey),
          })
        : store.getState().startScenario(start));
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
  // A choice the owned packs no longer offer has no cover to show it, so it can't go on.
  const offered = offeredTargets(mode, ownedPacks()).some(
    (target) => target.entry.id === choices.targetId,
  );
  const canContinue =
    step === 'scenario'
      ? scenario !== undefined && offered
      : step === 'setup' || investigators.length > 0;
  const target = chosenCampaign(choices) ?? scenario;
  const targetName = target && t(target.nameKey);
  // The pinned button says what the players take with them to the next step.
  const carried =
    step === 'scenario'
      ? targetName
      : step === 'setup'
        ? targetName && `${targetName} · ${t(`wizard.difficulties.${choices.difficulty}`)}`
        : new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(
            investigators.map((investigator) => investigator.name),
          );
  // The first step is named after what it chooses: the campaign or the scenario.
  const needsCatalog = step === 'investigators' || step === 'summary';
  const stepName = (name: WizardStep) =>
    t(
      name === 'scenario' && mode === 'campaign' ? 'wizard.steps.campaign' : `wizard.steps.${name}`,
    );

  return (
    <>
      <hgroup>
        <p>{t('wizard.stepOf', { step: index + 1, count: WIZARD_STEPS.length })}</p>
        <h1>{stepName(step)}</h1>
      </hgroup>
      <ol aria-label={t('wizard.steps.label')}>
        {WIZARD_STEPS.map((name, at) => (
          <li
            key={name}
            aria-current={name === step ? 'step' : undefined}
            data-done={at < index || undefined}
          >
            {stepName(name)}
          </li>
        ))}
      </ol>
      <section id="wizard" aria-label={stepName(step)}>
        {step === 'scenario' && (
          <TargetCovers choices={choices} ownedPacks={ownedPacks()} onChange={update} />
        )}
        {step === 'setup' && <SetupStep choices={choices} onChange={update} />}
        {needsCatalog && catalog.status === 'loading' && (
          <p>
            <Spinner />
            {t('wizard.loadingCatalog')}
          </p>
        )}
        {needsCatalog && catalog.status === 'failed' && <CatalogFailed retry={catalog.retry} />}
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
        {next && carried && <p>{carried}</p>}
        {next ? (
          <button data-primary disabled={!canContinue} onClick={() => goTo(next)}>
            {t('wizard.nextTo', { step: stepName(next) })}
          </button>
        ) : (
          <button data-primary disabled={!canContinue} onClick={() => void start()}>
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
