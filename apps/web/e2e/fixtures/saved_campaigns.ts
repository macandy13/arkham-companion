import type { Page } from '@playwright/test';

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
    {
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
    },
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
}
