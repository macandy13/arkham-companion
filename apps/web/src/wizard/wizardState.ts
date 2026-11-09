import type { CardCode } from '@arkham/carddata';
import {
  DEFAULT_RELIANCE,
  RELIANCES,
  scenarioId,
  type Difficulty,
  type Reliance,
} from '@arkham/engine';
import {
  campaignCatalog,
  findCampaignOfScenario,
  findScenario,
  scenarioCatalog,
  type CampaignEntry,
  type ScenarioEntry,
} from '../scenarios/scenarioCatalog';

/** The two entry points of the wizard (home screen links `/new?mode=…`). */
export type WizardMode = 'campaign' | 'quick';

/** Wizard steps in order; the current one is part of the URL so browser back/forward walks them. */
export const WIZARD_STEPS = ['scenario', 'setup', 'investigators', 'summary'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

/** Difficulties in the order they are offered. */
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'standard', 'hard', 'expert'];

/** What the players have chosen so far. Persisted per tab, so a refresh keeps it. */
export interface WizardChoices {
  mode: WizardMode;
  /** Campaign id in `campaign` mode, scenario id in `quick` mode. */
  targetId: string;
  difficulty: Difficulty;
  /** How much the players rely on the helpers in the game or the whole campaign. */
  reliance: Reliance;
  /** Investigator codes in seat order. */
  seats: CardCode[];
}

const STORAGE_KEY = 'arkham.newGameWizard';

/** `mode` query value as a `WizardMode`; `undefined` if absent or unknown. */
export function parseMode(value: string | null): WizardMode | undefined {
  return value === 'campaign' || value === 'quick' ? value : undefined;
}

/** `step` query value as a `WizardStep`; the first step if absent or unknown. */
export function parseStep(value: string | null): WizardStep {
  return WIZARD_STEPS.find((step) => step === value) ?? WIZARD_STEPS[0];
}

/**
 * Fresh choices for `mode`: the first campaign or scenario, standard difficulty, every change
 * shown, nobody seated.
 */
export function defaultChoices(mode: WizardMode): WizardChoices {
  const first = mode === 'campaign' ? campaignCatalog[0]?.id : scenarioCatalog[0]?.id;
  return {
    mode,
    targetId: first ?? '',
    difficulty: 'standard',
    reliance: DEFAULT_RELIANCE,
    seats: [],
  };
}

/** A campaign or a scenario the wizard offers, tagged so its cover knows which art to show. */
export type WizardTarget =
  | { readonly kind: 'campaign'; readonly entry: CampaignEntry }
  | { readonly kind: 'scenario'; readonly entry: ScenarioEntry };

/**
 * What the first step offers in `mode` (MD.3f): the campaigns, or in a quick game the scenarios,
 * of the packs the players own. A scenario belongs to its campaign's packs; one outside any
 * campaign has no packs listed and is always offered. Without owned packs (none set in Settings)
 * everything is offered.
 */
export function offeredTargets(mode: WizardMode, ownedPacks?: ReadonlySet<string>): WizardTarget[] {
  const owned = (packCodes: readonly string[] | undefined) =>
    ownedPacks === undefined ||
    packCodes === undefined ||
    packCodes.some((code) => ownedPacks.has(code));
  return mode === 'campaign'
    ? campaignCatalog
        .filter((entry) => owned(entry.packCodes))
        .map((entry) => ({ kind: 'campaign', entry }))
    : scenarioCatalog
        .filter((entry) => owned(findCampaignOfScenario(entry.definition.id)?.packCodes))
        .map((entry) => ({ kind: 'scenario', entry }));
}

/** The campaign the choices will start; `undefined` in a quick game. */
export function chosenCampaign(choices: WizardChoices): CampaignEntry | undefined {
  if (choices.mode === 'quick') return undefined;
  return campaignCatalog.find((entry) => entry.id === choices.targetId);
}

/** The scenario the choices will start: a campaign's first scenario, or the chosen one. */
export function chosenScenario(choices: WizardChoices): ScenarioEntry | undefined {
  if (choices.mode === 'quick') return findScenario(scenarioId(choices.targetId));
  const first = chosenCampaign(choices)?.definition.scenarios[0];
  return first && findScenario(first);
}

function isChoices(value: unknown): value is WizardChoices {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    parseMode(typeof v.mode === 'string' ? v.mode : null) !== undefined &&
    typeof v.targetId === 'string' &&
    DIFFICULTIES.some((d) => d === v.difficulty) &&
    RELIANCES.some((r) => r === v.reliance) &&
    Array.isArray(v.seats) &&
    v.seats.every((code) => typeof code === 'string')
  );
}

/**
 * Restores the choices saved by `saveChoices`, or starts fresh when nothing usable is stored for
 * `mode` (so switching between campaign and quick game never mixes up their choices).
 * sessionStorage can be missing or throw (private windows, blocked site data), so every failure
 * falls back to the defaults.
 */
export function loadChoices(mode: WizardMode): WizardChoices {
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
    if (isChoices(stored) && stored.mode === mode) return stored;
  } catch (error) {
    // Unusable storage only costs the remembered choices.
    console.warn('Could not restore the wizard choices; starting fresh.', error);
  }
  return defaultChoices(mode);
}

/** Saves the choices for this tab; skipped (with a warning) if storage is unavailable. */
export function saveChoices(choices: WizardChoices): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
  } catch (error) {
    // The wizard works without persistence.
    console.warn('Could not save the wizard choices; they are lost on refresh.', error);
  }
}

/** Forgets the saved choices, called once a game has been started. */
export function clearChoices(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    // Nothing to clean up if storage is unavailable.
    console.warn('Could not clear the wizard choices.', error);
  }
}
