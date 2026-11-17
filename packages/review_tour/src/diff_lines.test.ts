import { describe, expect, it } from 'vitest';
import { cutStopLines, parseDiff, type FileDiff } from './diff_lines.ts';

const CHANGED_FILE_DIFF = [
  'diff --git a/src/catalog.ts b/src/catalog.ts',
  'index 1111111..2222222 100644',
  '--- a/src/catalog.ts',
  '+++ b/src/catalog.ts',
  '@@ -1,3 +1,4 @@',
  ' import { load } from "./load";',
  '-const cached = () => load();',
  '+const cached = async () => {',
  '+  return load();',
  '+};',
  ' export { cached };',
].join('\n');

const NEW_FILE_DIFF = [
  'diff --git a/src/groups.ts b/src/groups.ts',
  'new file mode 100644',
  'index 0000000..3333333',
  '--- /dev/null',
  '+++ b/src/groups.ts',
  '@@ -0,0 +1,2 @@',
  "+export type Group = 'theirs' | 'basic';",
  '+export const groups = [];',
].join('\n');

describe('parseDiff', () => {
  it('reads each file by its head path, with its counts and lines', () => {
    const files = parseDiff(`${CHANGED_FILE_DIFF}\n${NEW_FILE_DIFF}`);

    expect(files.get('src/catalog.ts')).toEqual({
      newFile: false,
      added: 3,
      removed: 1,
      lines: [
        { kind: 'context', head: 1, text: 'import { load } from "./load";' },
        { kind: 'removed', base: 2, text: 'const cached = () => load();' },
        { kind: 'added', head: 2, text: 'const cached = async () => {' },
        { kind: 'added', head: 3, text: '  return load();' },
        { kind: 'added', head: 4, text: '};' },
        { kind: 'context', head: 5, text: 'export { cached };' },
      ],
    });
    expect(files.get('src/groups.ts')).toMatchObject({ newFile: true, added: 2, removed: 0 });
  });
});

describe('cutStopLines', () => {
  const catalogDiff: FileDiff = {
    newFile: false,
    added: 3,
    removed: 2,
    lines: [
      { kind: 'context', head: 1, text: 'import { load } from "./load";' },
      { kind: 'removed', base: 2, text: 'const cached = () => load();' },
      { kind: 'added', head: 2, text: 'const cached = async () => {' },
      { kind: 'added', head: 3, text: '  return load();' },
      { kind: 'added', head: 4, text: '};' },
      { kind: 'context', head: 5, text: 'export { cached };' },
      { kind: 'removed', base: 4, text: 'export default cached;' },
    ],
  };
  const catalogAtHead = [
    'import { load } from "./load";',
    'const cached = async () => {',
    '  return load();',
    '};',
    'export { cached };',
  ];

  it('shows the removed lines right before the added ones that replace them', () => {
    const lines = cutStopLines(
      { file: 'src/catalog.ts', ranges: [{ from: 2, to: 3 }], highlight: [] },
      catalogDiff,
      catalogAtHead,
    );

    expect(lines).toEqual([
      { kind: 'removed', number: 2, text: 'const cached = () => load();', highlighted: false },
      { kind: 'added', number: 2, text: 'const cached = async () => {', highlighted: false },
      { kind: 'added', number: 3, text: '  return load();', highlighted: false },
    ]);
  });

  it('puts a labelled gap between ranges and marks highlighted lines', () => {
    const lines = cutStopLines(
      {
        file: 'src/catalog.ts',
        ranges: [
          { from: 1, to: 1 },
          { from: 4, to: 4, label: 'the closing brace' },
        ],
        highlight: [4],
      },
      catalogDiff,
      catalogAtHead,
    );

    expect(lines).toEqual([
      { kind: 'context', number: 1, text: 'import { load } from "./load";', highlighted: false },
      { kind: 'gap', text: 'the closing brace' },
      { kind: 'added', number: 4, text: '};', highlighted: true },
    ]);
  });

  it('shows lines removed at the end of the file after its last line', () => {
    const lines = cutStopLines(
      { file: 'src/catalog.ts', ranges: [{ from: 5, to: 5 }], highlight: [] },
      catalogDiff,
      catalogAtHead,
    );

    expect(lines).toEqual([
      { kind: 'context', number: 5, text: 'export { cached };', highlighted: false },
      { kind: 'removed', number: 4, text: 'export default cached;', highlighted: false },
    ]);
  });

  it('shows a file the PR leaves alone as context', () => {
    const lines = cutStopLines(
      { file: 'src/rules.ts', ranges: [{ from: 2, to: 2 }], highlight: [] },
      undefined,
      ['// rules', 'export const aloof = true;'],
    );

    expect(lines).toEqual([
      { kind: 'context', number: 2, text: 'export const aloof = true;', highlighted: false },
    ]);
  });

  it('fails for a line past the end of the file', () => {
    expect(() =>
      cutStopLines(
        { file: 'src/catalog.ts', ranges: [{ from: 4, to: 9 }], highlight: [] },
        catalogDiff,
        catalogAtHead,
      ),
    ).toThrow("src/catalog.ts has 5 lines at the head commit; line 6 doesn't exist");
  });
});
