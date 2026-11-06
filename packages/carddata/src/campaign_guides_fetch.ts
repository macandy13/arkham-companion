import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { z } from 'zod';
import { layoutReport, scenarioLayouts, type ScenarioLayouts } from './campaign_guides';
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

/**
 * The layouts of each scenario of `campaign`, in the campaign's play order, then those of its
 * other files (the campaign-wide `core.json`) that have any, such as a campaign map.
 */
async function campaignLayouts(campaign: string): Promise<ScenarioLayouts[]> {
  const dir = campaignDir(campaign);
  const order = RawCampaignSchema.parse(await readJson(join(dir, 'campaign.json'))).scenarios;
  const files = (await readdir(dir)).filter(
    (file) => file.endsWith('.json') && file !== 'campaign.json',
  );
  const scenarios = await Promise.all(
    files.map(async (file) => scenarioLayouts(await readJson(join(dir, file)))),
  );
  const position = (scenario: ScenarioLayouts) => {
    const index = order.indexOf(scenario.id);
    return index === -1 ? order.length : index;
  };
  return scenarios
    .filter((scenario) => order.includes(scenario.id) || scenario.layouts.length > 0)
    .sort((a, b) => position(a) - position(b));
}

/** Usage: pnpm carddata:campaign <campaign ...>, e.g. `notz` or `rtnotz` (ArkhamCards' ids). */
async function main(): Promise<void> {
  const campaigns = process.argv.slice(2);
  if (campaigns.length === 0) throw new Error('Name at least one ArkhamCards campaign, e.g. notz');
  await updateClone();
  for (const campaign of campaigns) {
    const layouts = await campaignLayouts(campaign);
    const file = join(CACHE_DIR, 'campaign_guides', `${campaign}.json`);
    await mkdir(join(CACHE_DIR, 'campaign_guides'), { recursive: true });
    await writeFile(file, JSON.stringify(layouts, null, 2) + '\n');
    console.log([...layoutReport(layouts), `wrote ${file}`].join('\n'));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
