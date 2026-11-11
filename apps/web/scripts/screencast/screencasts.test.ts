import { describe, expect, it } from 'vitest';
import {
  SECTION_END,
  SECTION_START,
  changedFlows,
  changedShots,
  flowGrep,
  flowVideos,
  gifArgs,
  goldenChanges,
  goldenName,
  listedTests,
  PLAYER_PLACEHOLDER,
  playerPage,
  renderSection,
  replaceSection,
  slugify,
} from './screencasts.ts';
import type { GoldenChange, ListedTest, PlaywrightReport } from './screencasts.ts';

function result(status: string, video?: string) {
  return { status, attachments: video ? [{ name: 'video', path: video }] : [] };
}

describe('flowVideos', () => {
  it('lists the changed flows in their order, each with its video from the recording', () => {
    const report: PlaywrightReport = {
      suites: [
        {
          specs: [
            {
              title: 'Second flow',
              file: 'b.spec.ts',
              tests: [{ projectName: 'screencast', results: [result('passed', '/b.webm')] }],
            },
          ],
          suites: [
            {
              specs: [
                {
                  title: 'First flow',
                  file: 'a.spec.ts',
                  tests: [{ projectName: 'screencast', results: [result('passed', '/a.webm')] }],
                },
              ],
            },
          ],
        },
      ],
    };

    const flows = flowVideos(
      [
        { title: 'First flow', file: 'a.spec.ts' },
        { title: 'Second flow', file: 'b.spec.ts' },
      ],
      report,
    );

    expect(flows).toEqual([
      { title: 'First flow', slug: 'first-flow', videoPath: '/a.webm' },
      { title: 'Second flow', slug: 'second-flow', videoPath: '/b.webm' },
    ]);
  });

  it.each([
    {
      name: 'a retry passed',
      results: [result('failed', '/1.webm'), result('passed', '/2.webm')],
      video: '/2.webm',
    },
    { name: 'every attempt failed', results: [result('failed', '/1.webm')], video: undefined },
    { name: 'the passing run has no video', results: [result('passed')], video: undefined },
  ])('picks the last passing video when $name', ({ results, video }) => {
    const report: PlaywrightReport = {
      suites: [
        {
          specs: [
            { title: 'Flow', file: 'f.spec.ts', tests: [{ projectName: 'screencast', results }] },
          ],
        },
      ],
    };

    const [flow] = flowVideos([{ title: 'Flow', file: 'f.spec.ts' }], report);

    expect(flow?.videoPath).toBe(video);
  });

  it('shows a changed flow the recording lacks as not recorded', () => {
    expect(flowVideos([{ title: 'Flow', file: 'f.spec.ts' }], {})).toEqual([
      { title: 'Flow', slug: 'flow', videoPath: undefined },
    ]);
  });
});

describe('flowGrep', () => {
  const grep = new RegExp(
    flowGrep([
      { title: 'the settings', file: 'settings.spec.ts' },
      { title: 'fits a 1180 × 820 tablet (landscape)', file: 'tablet.spec.ts' },
    ]),
  );

  it.each([
    { name: 'the flow itself', title: 'screencast settings.spec.ts the settings', picked: true },
    {
      name: 'special characters, taken literally',
      title: 'screencast tablet.spec.ts fits a 1180 × 820 tablet (landscape)',
      picked: true,
    },
    {
      name: 'a describe block and a tag',
      title: 'screencast settings.spec.ts menu the settings @slow',
      picked: true,
    },
    {
      name: 'a title in another file ending in the flow title',
      title: 'screencast accessibility.spec.ts change the settings',
      picked: false,
    },
    {
      name: 'the same title in another file',
      title: 'screencast other.spec.ts the settings',
      picked: false,
    },
    {
      name: 'a title going on',
      title: 'screencast settings.spec.ts the settings twice',
      picked: false,
    },
  ])('matches $name: $picked', ({ title, picked }) => {
    expect(grep.test(title)).toBe(picked);
  });
});

describe('goldenChanges', () => {
  it('reads added, rewritten and deleted goldens with their project, spec file and name', () => {
    const nameStatus = [
      'M\te2e/__screenshots__/screenshot/shots/home_screen.spec.ts/a-game’s-menu-open-on-its-cover.png',
      'A\te2e/__screenshots__/screenshot-phone/shots/home_screen.spec.ts/the-game-list.png',
      'D\te2e/__screenshots__/flow-picture/lifecycle.spec.ts/start-a-game.png',
      '',
    ].join('\n');

    expect(goldenChanges(nameStatus)).toEqual([
      {
        status: 'changed',
        project: 'screenshot',
        file: 'shots/home_screen.spec.ts',
        name: 'a-game’s-menu-open-on-its-cover',
        path: 'e2e/__screenshots__/screenshot/shots/home_screen.spec.ts/a-game’s-menu-open-on-its-cover.png',
      },
      {
        status: 'added',
        project: 'screenshot-phone',
        file: 'shots/home_screen.spec.ts',
        name: 'the-game-list',
        path: 'e2e/__screenshots__/screenshot-phone/shots/home_screen.spec.ts/the-game-list.png',
      },
      {
        status: 'removed',
        project: 'flow-picture',
        file: 'lifecycle.spec.ts',
        name: 'start-a-game',
        path: 'e2e/__screenshots__/flow-picture/lifecycle.spec.ts/start-a-game.png',
      },
    ]);
  });

  it.each([
    { name: 'a file outside the goldens', line: 'M\tsrc/App.tsx' },
    { name: 'a golden without a spec file', line: 'M\te2e/__screenshots__/screenshot/lonely.png' },
    { name: 'a type change', line: 'T\te2e/__screenshots__/screenshot/a.spec.ts/shot.png' },
  ])('skips $name', ({ line }) => {
    expect(goldenChanges(line)).toEqual([]);
  });
});

describe('goldenName', () => {
  it.each([
    {
      titlePath: ["the app bar's menu open over the game list"],
      name: 'the-app-bar-s-menu-open-over-the-game-list',
    },
    { titlePath: ['a game’s menu open on its cover'], name: 'a-game’s-menu-open-on-its-cover' },
    {
      titlePath: ['each table with its own playmat', 'the house map on the parchment table'],
      name: 'each-table-with-its-own-playmat-the-house-map-on-the-parchment-table',
    },
    {
      titlePath: ['fits a 1180 × 820 tablet (landscape)'],
      name: 'fits-a-1180-×-820-tablet-landscape-',
    },
    { titlePath: ['opens v1.2 of the log'], name: 'opens-v1.2-of-the-log' },
  ])('names $titlePath as $name, the way Playwright does', ({ titlePath, name }) => {
    expect(goldenName(titlePath)).toBe(name);
  });

  it('cuts a title over 100 characters in the middle around a hash, keeping both ends', () => {
    const name = goldenName([`starts here ${'and goes on '.repeat(10)}and ends here`]);

    expect(name).toHaveLength(100);
    expect(name).toMatch(/^starts-here-and-goes-on-.*-[0-9a-f]{5}-.*-and-ends-here$/);
  });
});

describe('listedTests', () => {
  it('lists each test per project with its describe blocks, not its spec file', () => {
    const report: PlaywrightReport = {
      suites: [
        {
          title: 'shots/game_screen.spec.ts',
          specs: [
            {
              title: 'the house map',
              file: 'shots/game_screen.spec.ts',
              tests: [{ projectName: 'screenshot' }, { projectName: 'screenshot-phone' }],
            },
          ],
          suites: [
            {
              title: 'each table',
              specs: [
                {
                  title: 'on parchment',
                  file: 'shots/game_screen.spec.ts',
                  tests: [{ projectName: 'screenshot' }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(listedTests(report)).toEqual([
      { project: 'screenshot', file: 'shots/game_screen.spec.ts', titlePath: ['the house map'] },
      {
        project: 'screenshot-phone',
        file: 'shots/game_screen.spec.ts',
        titlePath: ['the house map'],
      },
      {
        project: 'screenshot',
        file: 'shots/game_screen.spec.ts',
        titlePath: ['each table', 'on parchment'],
      },
    ]);
  });
});

describe('changedFlows', () => {
  const listed: ListedTest[] = [
    { project: 'flow-picture', file: 'settings.spec.ts', titlePath: ["change the app's language"] },
  ];

  it('names a flow whose golden the PR rewrites by its title, for the grep', () => {
    const changes: GoldenChange[] = [
      {
        status: 'changed',
        project: 'flow-picture',
        file: 'settings.spec.ts',
        name: 'change-the-app-s-language',
        path: 'e2e/__screenshots__/flow-picture/settings.spec.ts/change-the-app-s-language.png',
      },
    ];

    expect(changedFlows(changes, listed)).toEqual([
      { title: "change the app's language", file: 'settings.spec.ts' },
    ]);
  });

  it('leaves out a deleted flow and the screenshot goldens', () => {
    const changes: GoldenChange[] = [
      {
        status: 'removed',
        project: 'flow-picture',
        file: 'old.spec.ts',
        name: 'a-gone-flow',
        path: 'e2e/__screenshots__/flow-picture/old.spec.ts/a-gone-flow.png',
      },
      {
        status: 'changed',
        project: 'screenshot',
        file: 'settings.spec.ts',
        name: 'change-the-app-s-language',
        path: 'e2e/__screenshots__/screenshot/settings.spec.ts/change-the-app-s-language.png',
      },
    ];

    expect(changedFlows(changes, listed)).toEqual([]);
  });
});

describe('changedShots', () => {
  const listed: ListedTest[] = [
    {
      project: 'screenshot',
      file: 'shots/home.spec.ts',
      titlePath: ['the game list, with one game'],
    },
  ];

  it('puts the desktop and phone goldens of one test into one shot, titled from the test list', () => {
    const changes: GoldenChange[] = [
      {
        status: 'changed',
        project: 'screenshot',
        file: 'shots/home.spec.ts',
        name: 'the-game-list-with-one-game',
        path: 'e2e/__screenshots__/screenshot/shots/home.spec.ts/the-game-list-with-one-game.png',
      },
      {
        status: 'added',
        project: 'screenshot-phone',
        file: 'shots/home.spec.ts',
        name: 'the-game-list-with-one-game',
        path: 'e2e/__screenshots__/screenshot-phone/shots/home.spec.ts/the-game-list-with-one-game.png',
      },
    ];

    expect(changedShots(changes, listed)).toEqual([
      {
        title: 'the game list, with one game',
        slug: 'the-game-list-with-one-game',
        pictures: {
          desktop: {
            before:
              'e2e/__screenshots__/screenshot/shots/home.spec.ts/the-game-list-with-one-game.png',
            after:
              'e2e/__screenshots__/screenshot/shots/home.spec.ts/the-game-list-with-one-game.png',
          },
          phone: {
            after:
              'e2e/__screenshots__/screenshot-phone/shots/home.spec.ts/the-game-list-with-one-game.png',
          },
        },
      },
    ]);
  });

  it('titles a deleted golden by its file name and leaves the unchanged device out', () => {
    const changes: GoldenChange[] = [
      {
        status: 'removed',
        project: 'screenshot-phone',
        file: 'shots/home.spec.ts',
        name: 'a-gone-shot',
        path: 'e2e/__screenshots__/screenshot-phone/shots/home.spec.ts/a-gone-shot.png',
      },
    ];

    expect(changedShots(changes, listed)).toEqual([
      {
        title: 'a gone shot',
        slug: 'a-gone-shot',
        pictures: {
          desktop: undefined,
          phone: {
            before: 'e2e/__screenshots__/screenshot-phone/shots/home.spec.ts/a-gone-shot.png',
          },
        },
      },
    ]);
  });
});

describe('slugify', () => {
  it.each([
    {
      title: 'App boots and a new game survives reload',
      slug: 'app-boots-and-a-new-game-survives-reload',
    },
    { title: '  Start: The Gathering!  ', slug: 'start-the-gathering' },
    { title: 'Mythos → Investigation', slug: 'mythos-investigation' },
  ])('turns "$title" into "$slug"', ({ title, slug }) => {
    expect(slugify(title)).toBe(slug);
  });
});

describe('gifArgs', () => {
  it('samples one frame per 250 ms step, holds each 4 times as long and loops forever', () => {
    const args = gifArgs({ input: 'in.webm', output: 'out.gif' });

    expect(args.slice(-3)).toEqual(['-loop', '0', 'out.gif']);
    expect(args[args.indexOf('-i') + 1]).toBe('in.webm');
    expect(args[args.indexOf('-vf') + 1]).toMatch(/^fps=4,setpts=4\*PTS,scale=800:-1/);
  });
});

describe('playerPage', () => {
  const template = `<script>const RECORDED = ${PLAYER_PLACEHOLDER};</script>`;

  it('lists the recorded flows by slug with their titles, and the version', () => {
    const page = playerPage(template, {
      flows: [
        { title: 'Create a game', slug: 'create-a-game', videoPath: '/v.webm' },
        { title: 'Broken flow', slug: 'broken-flow', videoPath: undefined },
      ],
      version: 'abc123',
    });

    expect(page).toBe(
      '<script>const RECORDED = {"version":"abc123","flows":{"create-a-game":"Create a game"}};</script>',
    );
  });

  it('escapes a title that would close the script element', () => {
    const page = playerPage(template, {
      flows: [{ title: '</script> flow', slug: 'script-flow', videoPath: '/v.webm' }],
      version: 'abc123',
    });

    expect(page).toContain('"script-flow":"\\u003c/script> flow"');
  });

  it('fails when the template has no placeholder', () => {
    expect(() => playerPage('<script></script>', { flows: [], version: 'abc123' })).toThrow(
      'no placeholder',
    );
  });
});

describe('renderSection', () => {
  const recorded = { title: 'Create a game', slug: 'create-a-game', videoPath: '/v.webm' };
  const failed = { title: 'Broken flow', slug: 'broken-flow', videoPath: undefined };

  it('embeds a cache-busted GIF from the picture host and links the player on Pages for a recorded flow', () => {
    const section = renderSection({
      flows: [recorded],
      shots: [],
      baseUrl: 'https://x.test/s',
      pictureBaseUrl: 'https://raw.x.test/s',
      version: 'abc123',
    });

    expect(section).toContain('![Create a game](https://raw.x.test/s/create-a-game.gif?v=abc123)');
    expect(section).toContain(
      '[Play with pause and speed controls](https://x.test/s/player.html?flow=create-a-game&v=abc123&speed=0.25)',
    );
  });

  it('shows the desktop and phone goldens side by side, before above after, cache-busted from the picture host, above the screencasts', () => {
    const section = renderSection({
      flows: [recorded],
      shots: [
        {
          title: 'Map tabs',
          slug: 'map-tabs',
          pictures: {
            desktop: { before: 'wide.png', after: 'wide.png' },
            phone: { before: 'narrow.png', after: 'narrow.png' },
          },
        },
      ],
      baseUrl: 'https://x.test/s',
      pictureBaseUrl: 'https://raw.x.test/s',
      version: 'abc123',
    });

    expect(section).toContain(
      [
        '### Map tabs',
        '',
        '<table>',
        '<tr><th></th><th>Desktop</th><th>Phone</th></tr>',
        '<tr><th>Before</th>' +
          '<td><img src="https://raw.x.test/s/map-tabs-desktop-before.png?v=abc123" alt="Desktop before" width="560"></td>' +
          '<td><img src="https://raw.x.test/s/map-tabs-phone-before.png?v=abc123" alt="Phone before" width="180"></td></tr>',
        '<tr><th>After</th>' +
          '<td><img src="https://raw.x.test/s/map-tabs-desktop-after.png?v=abc123" alt="Desktop after" width="560"></td>' +
          '<td><img src="https://raw.x.test/s/map-tabs-phone-after.png?v=abc123" alt="Phone after" width="180"></td></tr>',
        '</table>',
      ].join('\n'),
    );
    expect(section.indexOf('## Screenshots')).toBeLessThan(section.indexOf('## Screencasts'));
  });

  it('says which golden is new, removed or unchanged instead of linking a missing file', () => {
    const section = renderSection({
      flows: [],
      shots: [
        {
          title: 'New shot',
          slug: 'new-shot',
          pictures: { desktop: { after: 'n.png' }, phone: undefined },
        },
        {
          title: 'Gone shot',
          slug: 'gone-shot',
          pictures: { desktop: undefined, phone: { before: 'g.png' } },
        },
      ],
      baseUrl: 'https://x.test/s',
      pictureBaseUrl: 'https://raw.x.test/s',
      version: 'abc123',
    });

    expect(section).toContain('<tr><th>Before</th><td>New</td><td>Unchanged</td></tr>');
    expect(section).toContain('<tr><th>After</th><td>Unchanged</td><td>Removed</td></tr>');
    expect(section).not.toContain('new-shot-desktop-before.png');
    expect(section).not.toContain('gone-shot-phone-after.png');
  });

  it('lists the changed flows past the recording limit by name under the screencasts', () => {
    const section = renderSection({
      flows: [recorded],
      shots: [],
      moreFlows: ['Play a turn', 'Win the game'],
      baseUrl: 'https://x.test/s',
      pictureBaseUrl: 'https://raw.x.test/s',
      version: 'abc123',
    });

    expect(section).toContain(
      '_Also changed, not recorded (at most 5 per push): Play a turn; Win the game._',
    );
    expect(section.indexOf('### Create a game')).toBeLessThan(section.indexOf('Also changed'));
  });

  it('is just the markers when the PR changes no golden', () => {
    const section = renderSection({
      flows: [],
      shots: [],
      baseUrl: 'https://x.test/s',
      pictureBaseUrl: 'https://raw.x.test/s',
      version: 'abc123',
    });

    expect(section).toBe('<!-- screencasts:start -->\n<!-- screencasts:end -->');
  });

  it('notes a failed flow instead of linking a missing file', () => {
    const section = renderSection({
      flows: [failed],
      shots: [],
      baseUrl: 'https://x.test/s/',
      pictureBaseUrl: 'https://raw.x.test/s/',
      version: 'abc123',
    });

    expect(section).toContain('### Broken flow');
    expect(section).toContain('Not recorded');
    expect(section).not.toContain('broken-flow.gif');
  });

  it('is wrapped in the section markers', () => {
    const section = renderSection({
      flows: [],
      shots: [],
      baseUrl: 'https://x.test/s/',
      pictureBaseUrl: 'https://raw.x.test/s/',
      version: 'abc123',
    });

    expect(section.startsWith(SECTION_START)).toBe(true);
    expect(section.endsWith(SECTION_END)).toBe(true);
  });
});

describe('replaceSection', () => {
  const section = `${SECTION_START}\nnew\n${SECTION_END}`;

  it.each([
    {
      name: 'replaces an existing section and keeps the text around it',
      body: `## Motivation\n\nwhy\n\n${SECTION_START}\nold\n${SECTION_END}\n\nfooter`,
      expected: `## Motivation\n\nwhy\n\n${section}\n\nfooter`,
    },
    {
      name: 'appends the section when the markers are missing',
      body: '## Motivation\n\nwhy\n',
      expected: `## Motivation\n\nwhy\n\n${section}\n`,
    },
    { name: 'fills an empty description', body: '', expected: `${section}\n` },
    {
      name: 'appends when only the end marker is present',
      body: `text ${SECTION_END}`,
      expected: `text ${SECTION_END}\n\n${section}\n`,
    },
  ])('$name', ({ body, expected }) => {
    expect(replaceSection(body, section)).toBe(expected);
  });
});
