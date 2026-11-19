/** The device a golden project photographs, as the page's picture toggle names it. */
export type Device = 'desktop' | 'phone' | 'tablet';

/** Where the committed goldens live; one directory per Playwright project below it. */
export const GOLDEN_DIR = 'apps/web/e2e/__screenshots__';

/** The golden projects (`apps/web/playwright.config.ts`) in the order the toggle lists them. */
const PROJECTS: readonly { readonly project: string; readonly device: Device }[] = [
  { project: 'screenshot', device: 'desktop' },
  { project: 'screenshot-phone', device: 'phone' },
  { project: 'flow-picture', device: 'tablet' },
];

/** One device's golden of a stop's picture, as repo paths at the base and head commits. */
export interface PictureVariant {
  readonly device: Device;
  /** Absent when the PR adds the golden. */
  readonly before?: string;
  /** Absent when the PR removes it. */
  readonly after?: string;
}

/**
 * The goldens a stop's `picture` names, for every device that has it at the base or the head
 * commit. Throws when no device has it, so a misspelt name fails the page instead of showing nothing.
 */
export function pictureVariants(
  picture: string,
  baseFiles: ReadonlySet<string>,
  headFiles: ReadonlySet<string>,
): PictureVariant[] {
  const variants = PROJECTS.flatMap(({ project, device }): PictureVariant[] => {
    const path = `${GOLDEN_DIR}/${project}/${picture}`;
    const before = baseFiles.has(path) ? { before: path } : {};
    const after = headFiles.has(path) ? { after: path } : {};
    return baseFiles.has(path) || headFiles.has(path) ? [{ device, ...before, ...after }] : [];
  });
  if (variants.length === 0) {
    throw new Error(
      `No golden named ${picture} below ${GOLDEN_DIR}/<project>/ at the base or head commit`,
    );
  }
  return variants;
}
