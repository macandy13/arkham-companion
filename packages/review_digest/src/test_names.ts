/** One test as `vitest list --json` prints it: the full name joins describes with ` > `. */
export interface ListedTest {
  readonly name: string;
  readonly file: string;
}

/**
 * The tests a PR adds and removes in one test file, by full name. A renamed test shows
 * as one removal and one addition, which is what the reviewer needs to see: the claim
 * changed.
 */
export interface TestNameChanges {
  readonly file: string;
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

/**
 * Compares the test lists of the base branch and the PR head, per file (repo-relative,
 * so the two checkouts' different roots don't matter). Files without changes are left
 * out; the rest are sorted by path, names keep their order in the file.
 */
export function diffTestNames(
  base: readonly ListedTest[],
  head: readonly ListedTest[],
  roots: { readonly base: string; readonly head: string },
): TestNameChanges[] {
  const baseByFile = namesByFile(base, roots.base);
  const headByFile = namesByFile(head, roots.head);
  const files = [...new Set([...baseByFile.keys(), ...headByFile.keys()])].sort();
  return files.flatMap((file) => {
    const before = baseByFile.get(file) ?? [];
    const after = headByFile.get(file) ?? [];
    const added = after.filter((name) => !before.includes(name));
    const removed = before.filter((name) => !after.includes(name));
    return added.length + removed.length > 0 ? [{ file, added, removed }] : [];
  });
}

function namesByFile(tests: readonly ListedTest[], root: string): Map<string, string[]> {
  const byFile = new Map<string, string[]>();
  for (const { name, file } of tests) {
    const relative = file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file;
    byFile.set(relative, [...(byFile.get(relative) ?? []), name]);
  }
  return byFile;
}
