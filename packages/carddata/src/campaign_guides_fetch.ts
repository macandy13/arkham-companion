import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { z } from 'zod';
import { layoutReport, scenarioLayouts } from './campaign_guides';
import { campaignChaosBags, scenarioSetup, setupReport } from './campaign_setup';
import { CACHE_DIR } from './fetch';

const run = promisify(execFile);

const REPOSITORY = 'https://github.com/zzorba/arkham-cards-data.git';

/** Where the shallow clone lives; `.cache/` is gitignored, so the unlicensed data stays local. */
const CLONE_DIR = join(CACHE_DIR, 'arkham_cards_data');

/** The folders the campaign guides sit in: the campaigns, and the Return to boxes apart. */
const CAMPAIGN_ROOTS = ['campaigns', 'return_campaigns'] as const;

/** The part of a `campaign.json` read here: its scenario ids in play order. */
const RawCampaignSchema = z.object({ scenarios: z.array(z.string()) });

/**
 * Clones the guide data once, then brings it up to date. A git clone, not single files over
 * HTTP, because the scenario files' names (`01_spreading_flames.json`) are not their ids and
 * raw file hosting lists no directories.
 */
async function updateClone(): Promise<void> {
  if (!existsSync(join(CLONE_DIR, '.git'))) {
    await mkdir(CACHE_DIR, { recursive: true });
    await run('git', [
      'clone',
      '--depth',
      '1',
      '--filter=blob:none',
      '--sparse',
      REPOSITORY,
      CLONE_DIR,
    ]);
    await run('git', ['-C', CLONE_DIR, 'sparse-checkout', 'set', ...CAMPAIGN_ROOTS]);
    return;
  }
  await run('git', ['-C', CLONE_DIR, 'fetch', '--depth', '1', 'origin', 'HEAD']);
  await run('git', ['-C', CLONE_DIR, 'reset', '--hard', 'FETCH_HEAD']);
}

function campaignDir(campaign: string): string {
  const dir = CAMPAIGN_ROOTS.map((root) => join(CLONE_DIR, root, campaign)).find(existsSync);
  if (!dir)
    throw new Error(`No ArkhamCards campaign "${campaign}" in ${CAMPAIGN_ROOTS.join(', ')}`);
  return dir;
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8')) as unknown;
}

/** A campaign's files as read from the clone: its `campaign.json` and every other file of it. */
interface RawCampaignFiles {
  campaign: unknown;
  scenarios: unknown[];
}

async function readCampaign(campaign: string): Promise<RawCampaignFiles> {
  const dir = campaignDir(campaign);
  const files = (await readdir(dir)).filter(
    (file) => file.endsWith('.json') && file !== 'campaign.json',
  );
  return {
    campaign: await readJson(join(dir, 'campaign.json')),
    scenarios: await Promise.all(files.map((file) => readJson(join(dir, file)))),
  };
}

/** `items` in the campaign's play order (`order`), the ones it doesn't list last. */
function inPlayOrder<T extends { id: string }>(items: T[], order: readonly string[]): T[] {
  const position = (item: T) => {
    const index = order.indexOf(item.id);
    return index === -1 ? order.length : index;
  };
  return [...items].sort((a, b) => position(a) - position(b));
}

/**
 * The import of one campaign: its bags, and per scenario in play order its layouts and setup.
 * Files the campaign doesn't list as scenarios (the campaign-wide `core.json`) are kept only
 * when they have a layout, such as a campaign map.
 */
function importCampaign(files: RawCampaignFiles) {
  const order = RawCampaignSchema.parse(files.campaign).scenarios;
  const layouts = inPlayOrder(files.scenarios.map(scenarioLayouts), order).filter(
    (scenario) => order.includes(scenario.id) || scenario.layouts.length > 0,
  );
  const setups = inPlayOrder(files.scenarios.map(scenarioSetup), order).filter((scenario) =>
    order.includes(scenario.id),
  );
  return { chaosBags: campaignChaosBags(files.campaign), layouts, setups };
}

/** Usage: pnpm carddata:campaign <campaign ...>, e.g. `notz` or `rtnotz` (ArkhamCards' ids). */
async function main(): Promise<void> {
  const campaigns = process.argv.slice(2);
  if (campaigns.length === 0) throw new Error('Name at least one ArkhamCards campaign, e.g. notz');
  await updateClone();
  for (const campaign of campaigns) {
    const imported = importCampaign(await readCampaign(campaign));
    const file = join(CACHE_DIR, 'campaign_guides', `${campaign}.json`);
    await mkdir(join(CACHE_DIR, 'campaign_guides'), { recursive: true });
    await writeFile(file, JSON.stringify(imported, null, 2) + '\n');
    const report = [
      ...layoutReport(imported.layouts),
      ...setupReport(imported.chaosBags, imported.setups),
      `wrote ${file}`,
    ];
    console.log(report.join('\n'));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
