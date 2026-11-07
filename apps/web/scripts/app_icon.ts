/**
 * Writes the app's icon files (MD.4a) from the mark's geometry (`src/brand/appMark.ts`): the
 * SVG the browser tab and the manifest use, and the PNGs a home screen needs (192 and 512 px, a
 * maskable 512 with the mark inside the safe zone, and the 180 px apple-touch icon). Run it after
 * changing the mark: `node apps/web/scripts/app_icon.ts`. The files are committed, so a build
 * never needs a browser.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { appMarkSvg, MARK_COLOURS } from '../src/brand/appMark.ts';

/** A maskable icon keeps its content in the middle 80 % (the safe zone), so the mark is inset. */
const MASKABLE_INSET = 0.12;

const publicDir = (name: string) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));

const plain = appMarkSvg(MARK_COLOURS);
const maskable = appMarkSvg({ ...MARK_COLOURS, inset: MASKABLE_INSET });

const pngs: { file: string; size: number; svg: string }[] = [
  { file: 'icon-192.png', size: 192, svg: plain },
  { file: 'icon-512.png', size: 512, svg: plain },
  { file: 'icon-maskable-512.png', size: 512, svg: maskable },
  { file: 'apple-touch-icon.png', size: 180, svg: maskable },
];

await writeFile(publicDir('icon.svg'), `${plain}\n`);
// Where the sandbox keeps its browser (playwright.config.ts reads the same variable).
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH });
try {
  for (const { file, size, svg } of pngs) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`,
    );
    await page.screenshot({ path: publicDir(file), omitBackground: false });
    await page.close();
  }
} finally {
  await browser.close();
}
