/**
 * Writes `packages/<name>/api.md` for every package in {@link API_PACKAGES}, run by
 * `pnpm api:report` and checked for drift in CI:
 *
 *   node packages/review_digest/src/api_report_cli.ts
 *
 * The packages export TypeScript sources, so the declarations are emitted first into the
 * package's gitignored `.api/` folder and API Extractor reads them from there (it needs
 * them inside the package to find its package.json).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Extractor, ExtractorConfig, ExtractorLogLevel } from '@microsoft/api-extractor';
import { API_PACKAGES, cleanApiReport } from './api_report.ts';

const repoRoot = resolve(import.meta.dirname, '../../..');

function emitDeclarations(packageDir: string, outDir: string): string {
  execFileSync(
    'pnpm',
    [
      'exec',
      'tsc',
      '-p',
      join(packageDir, 'tsconfig.json'),
      '--noEmit',
      'false',
      '--declaration',
      '--emitDeclarationOnly',
      '--outDir',
      outDir,
    ],
    { cwd: repoRoot, stdio: 'inherit' },
  );
  // tsc roots the output at the common folder of the included files: src/ alone, or the
  // package itself when the tsconfig also includes test/.
  const entry = [join(outDir, 'index.d.ts'), join(outDir, 'src', 'index.d.ts')].find(existsSync);
  if (!entry) throw new Error(`no index.d.ts emitted for ${packageDir}`);
  return entry;
}

function writeReport(name: string): void {
  const packageDir = join(repoRoot, 'packages', name);
  const workDir = join(packageDir, '.api');
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  const config = ExtractorConfig.prepare({
    configObjectFullPath: join(workDir, 'api-extractor.json'),
    packageJsonFullPath: join(packageDir, 'package.json'),
    configObject: {
      projectFolder: packageDir,
      mainEntryPointFilePath: emitDeclarations(packageDir, join(workDir, 'dts')),
      compiler: { tsconfigFilePath: join(packageDir, 'tsconfig.json') },
      apiReport: {
        enabled: true,
        reportFileName: 'report.api.md',
        reportFolder: workDir,
        reportTempFolder: workDir,
      },
      docModel: { enabled: false },
      dtsRollup: { enabled: false },
      tsdocMetadata: { enabled: false },
      messages: {
        extractorMessageReporting: { default: { logLevel: ExtractorLogLevel.None } },
        tsdocMessageReporting: { default: { logLevel: ExtractorLogLevel.None } },
      },
    },
  });
  const result = Extractor.invoke(config, { localBuild: true, showVerboseMessages: false });
  if (!result.succeeded) throw new Error(`API Extractor failed for ${name}`);
  const report = readFileSync(join(workDir, 'report.api.md'), 'utf8');
  writeFileSync(join(packageDir, 'api.md'), cleanApiReport(report));
}

for (const name of API_PACKAGES) writeReport(name);
