import type { Page } from '@playwright/test';
import { waitUntilSettled } from './test';

/** A Night of the Zealot investigator in the campaign log as `CampaignStarted` writes them. */
interface LoggedInvestigator {
  readonly code: string;
  readonly name: string;
  readonly health: number;
  readonly sanity: number;
}

/** The invented catalog's investigators (`cards.json`). */
export const fakeSeeker: LoggedInvestigator = {
  code: '90001',
  name: 'Fake Seeker',
  health: 6,
  sanity: 8,
};
export const fakeGuardian: LoggedInvestigator = {
  code: '90002',
  name: 'Fake Guardian',
  health: 9,
  sanity: 5,
};
export const rolandBanks: LoggedInvestigator = {
  code: '01001',
  name: 'Roland Banks',
  health: 9,
  sanity: 5,
};

/** `CampaignStarted` for a Night of the Zealot campaign on Easy with `team`, unhurt. */
function zealotStarted(campaignId: string, team: readonly LoggedInvestigator[]): unknown {
  return {
    type: 'CampaignStarted',
    campaignId,
    definitionId: 'night-of-the-zealot',
    difficulty: 'easy',
    investigators: team.map((investigator) => ({
      ...investigator,
      physicalTrauma: 0,
      mentalTrauma: 0,
      xpEarned: 0,
      xpSpent: 0,
      fate: 'alive',
      earnedCards: [],
    })),
    chaosBag: ['0'],
    scenarioIds: ['the-gathering', 'the-midnight-masks', 'the-devourer-below'],
  };
}

/**
 * The events of a Night of the Zealot campaign on Easy with `team` that played each scenario to
 * its resolution 1 and so won, Umôrdhoth banished. Every investigator earned 4 XP per scenario,
 * spent 2 of them, and came out with one physical and one mental trauma.
 */
export function zealotWonEvents(
  campaignId: string,
  team: readonly LoggedInvestigator[],
): unknown[] {
  return [
    zealotStarted(campaignId, team),
    ...['the-gathering', 'the-midnight-masks', 'the-devourer-below'].flatMap((scenarioId, i) => [
      { type: 'ScenarioPlayed', scenarioId, outcome: { kind: 'resolution', id: 'R1' } },
      ...team.flatMap(({ code }) => [
        { type: 'XpChanged', code, account: 'earned', delta: 4 },
        { type: 'XpChanged', code, account: 'spent', delta: 2 },
      ]),
      { type: 'ScenarioPositionChanged', position: i + 1 },
    ]),
    ...team.flatMap(({ code }) => [
      { type: 'TraumaChanged', code, kind: 'physical', delta: 1 },
      { type: 'TraumaChanged', code, kind: 'mental', delta: 1 },
    ]),
    { type: 'CampaignEnded', result: 'won' },
  ];
}

/**
 * The events of a Night of the Zealot campaign on Easy with `team`, after The Gathering's
 * resolution 3 killed `killed` and left the house standing: the log then waits for The Midnight
 * Masks.
 */
export function gatheringKilledEvents(
  campaignId: string,
  team: readonly LoggedInvestigator[],
  killed: LoggedInvestigator,
): unknown[] {
  return [
    zealotStarted(campaignId, team),
    { type: 'StoryRecorded', key: 'houseStillStanding', value: { kind: 'flag', value: true } },
    { type: 'InvestigatorFateChanged', code: killed.code, fate: 'killed' },
    {
      type: 'ScenarioPlayed',
      scenarioId: 'the-gathering',
      outcome: { kind: 'resolution', id: 'R3' },
    },
    { type: 'ScenarioPositionChanged', position: 1 },
  ];
}

/**
 * The events of the E2E builds' interlude test campaign (`interludeTestCampaign`) on Easy with
 * `team`, The Gathering played to its resolution 1: its interlude "A Sleepless Night" is due.
 */
export function interludeDueEvents(
  campaignId: string,
  team: readonly LoggedInvestigator[],
): unknown[] {
  const started = zealotStarted(campaignId, team) as Record<string, unknown>;
  return [
    { ...started, definitionId: 'interlude-test' },
    {
      type: 'ScenarioPlayed',
      scenarioId: 'the-gathering',
      outcome: { kind: 'resolution', id: 'R1' },
    },
    { type: 'ScenarioPositionChanged', position: 1 },
  ];
}

/**
 * Stores a campaign whose log is `events(campaignId)` straight into the app's database, as the
 * app has no campaign import yet, and opens its log. The app must have created the database
 * first, so it loads the home screen and waits for the schema before writing.
 */
export async function openStoredCampaign(
  page: Page,
  title: string,
  events: (campaignId: string) => unknown[],
): Promise<void> {
  await page.goto('/#/');
  // Dexie's schema version 3 is IndexedDB version 30.
  await page.waitForFunction(async () =>
    (await indexedDB.databases()).some(
      ({ name, version }) => name === 'arkham-companion' && (version ?? 0) >= 30,
    ),
  );
  const campaignId = 'e2e-campaign';
  await page.evaluate(
    async ({ campaignId, title, events }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('arkham-companion');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Could not open the database'));
      });
      const now = Date.now();
      const write = db.transaction(['campaigns', 'campaignEvents'], 'readwrite');
      write.objectStore('campaigns').put({
        campaignId,
        title,
        createdAt: now,
        updatedAt: now,
        lastSeq: events.length,
      });
      events.forEach((event, i) =>
        write
          .objectStore('campaignEvents')
          .put({ campaignId, seq: i + 1, timestamp: now, commandId: 'e2e', event }),
      );
      await new Promise<void>((resolve, reject) => {
        write.oncomplete = () => resolve();
        write.onerror = () => reject(write.error ?? new Error('Could not store the campaign'));
      });
      db.close();
    },
    { campaignId, title, events: events(campaignId) },
  );
  await page.goto(`/#/campaign/${campaignId}`);
  await waitUntilSettled(page);
}
