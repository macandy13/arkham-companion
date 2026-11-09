import { describe, expect, it } from 'vitest';
import {
  SECTION_END,
  SECTION_START,
  changedFlows,
  flowGrep,
  flowVideos,
  gifArgs,
  joinReports,
  PLAYER_PLACEHOLDER,
  playerPage,
  renderSection,
  replaceSection,
  screenshots,
  slugify,
} from './screencasts.ts';
import type { PlaywrightReport } from './screencasts.ts';

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

describe('screenshots', () => {
  it('reads only the screenshot projects, not the flow pictures', () => {
    const report: PlaywrightReport = {
      suites: [
        {
          specs: [
            {
              title: 'Read the map',
              tests: [
                {
                  projectName: 'flow-picture',
                  results: [
                    { status: 'passed', attachments: [{ name: 'screenshot', path: '/map.png' }] },
                  ],
                },
              ],
            },
            {
              title: 'Map tabs',
              tests: [
                {
                  projectName: 'screenshot',
                  results: [
                    { status: 'passed', attachments: [{ name: 'screenshot', path: '/tabs.png' }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(screenshots(report)).toEqual([
      {
        title: 'Map tabs',
        slug: 'map-tabs',
        pictures: { desktop: '/tabs.png', phone: undefined },
      },
    ]);
    expect(changedFlows(report)).toEqual([{ title: 'Read the map' }]);
  });

  it('takes the desktop picture from screenshot and the phone picture from screenshot-phone', () => {
    // Playwright lists the spec once per project.
    const report: PlaywrightReport = {
      suites: [
        {
          specs: [
            {
              title: 'Map tabs',
              file: 'map.spec.ts',
              tests: [
                {
                  projectName: 'screenshot',
                  results: [
                    { status: 'passed', attachments: [{ name: 'screenshot', path: '/wide.png' }] },
                  ],
                },
              ],
            },
            {
              title: 'Map tabs',
              file: 'map.spec.ts',
              tests: [
                {
                  projectName: 'screenshot-phone',
                  results: [
                    {
                      status: 'passed',
                      attachments: [{ name: 'screenshot', path: '/narrow.png' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(screenshots(report)).toEqual([
      {
        title: 'Map tabs',
        slug: 'map-tabs',
        pictures: { desktop: '/wide.png', phone: '/narrow.png' },
      },
    ]);
  });
});

describe('specs the base also records', () => {
  const shot = (file: string, title: string, picture: string, phonePicture?: string) => ({
    title,
    file,
    tests: [
      {
        projectName: 'screenshot',
        results: [{ status: 'passed', attachments: [{ name: 'screenshot', path: picture }] }],
      },
      ...(phonePicture
        ? [
            {
              projectName: 'screenshot-phone',
              results: [
                { status: 'passed', attachments: [{ name: 'screenshot', path: phonePicture }] },
              ],
            },
          ]
        : []),
    ],
  });
  const flow = (file: string, title: string, endPicture: string) => ({
    title,
    file,
    tests: [
      {
        projectName: 'flow-picture',
        results: [{ status: 'passed', attachments: [{ name: 'screenshot', path: endPicture }] }],
      },
    ],
  });
  // Pictures count as the same when their names say so: '/head/attic_old.png' matches '/base/attic_old.png'.
  const samePicture = (head: string, base: string) =>
    head.replace('/head/', '') === base.replace('/base/', '');

  it('are left out when their picture is unchanged, and shown when the PR changes it', () => {
    const head: PlaywrightReport = {
      suites: [
        {
          specs: [
            shot('map.spec.ts', 'unchanged attic', '/head/attic_old.png'),
            shot('map.spec.ts', 'restyled hallway', '/head/hallway_new.png'),
            shot('map.spec.ts', 'new cellar', '/head/cellar.png'),
          ],
        },
      ],
    };
    const base: PlaywrightReport = {
      suites: [
        {
          specs: [
            shot('map.spec.ts', 'unchanged attic', '/base/attic_old.png'),
            shot('map.spec.ts', 'restyled hallway', '/base/hallway_old.png'),
          ],
        },
      ],
    };

    const shown = screenshots(head, { report: base, samePicture }).map((s) => s.title);

    expect(shown).toEqual(['restyled hallway', 'new cellar']);
  });

  it("are shown as not taken when the PR's run failed, even though the base has a picture", () => {
    const head: PlaywrightReport = {
      suites: [
        {
          specs: [
            {
              title: 'broken attic',
              file: 'map.spec.ts',
              tests: [
                { projectName: 'screenshot', results: [{ status: 'failed', attachments: [] }] },
              ],
            },
          ],
        },
      ],
    };
    const base: PlaywrightReport = {
      suites: [{ specs: [shot('map.spec.ts', 'broken attic', '/base/attic.png')] }],
    };

    expect(screenshots(head, { report: base, samePicture })).toEqual([
      {
        title: 'broken attic',
        slug: 'broken-attic',
        pictures: { desktop: undefined, phone: undefined },
      },
    ]);
  });

  it('are left out when the phone fails on both sides and the desktop picture is unchanged', () => {
    const failedOnPhone = (picture: string) => ({
      title: 'attic',
      file: 'map.spec.ts',
      tests: [
        {
          projectName: 'screenshot',
          results: [{ status: 'passed', attachments: [{ name: 'screenshot', path: picture }] }],
        },
        { projectName: 'screenshot-phone', results: [{ status: 'failed', attachments: [] }] },
      ],
    });
    const head: PlaywrightReport = { suites: [{ specs: [failedOnPhone('/head/desk.png')] }] };
    const base: PlaywrightReport = { suites: [{ specs: [failedOnPhone('/base/desk.png')] }] };

    expect(screenshots(head, { report: base, samePicture })).toEqual([]);
  });

  it.each([
    { name: 'both unchanged, left out', headPhone: '/head/phone_old.png', shown: [] },
    { name: 'only the phone changed, shown', headPhone: '/head/phone_new.png', shown: ['attic'] },
  ])('compare a shot on every device: $name', ({ headPhone, shown }) => {
    const head: PlaywrightReport = {
      suites: [{ specs: [shot('map.spec.ts', 'attic', '/head/desk_old.png', headPhone)] }],
    };
    const base: PlaywrightReport = {
      suites: [
        { specs: [shot('map.spec.ts', 'attic', '/base/desk_old.png', '/base/phone_old.png')] },
      ],
    };

    expect(screenshots(head, { report: base, samePicture }).map((s) => s.title)).toEqual(shown);
  });

  it('show a shot the base took on the desktop only, since its phone picture is new', () => {
    const head: PlaywrightReport = {
      suites: [{ specs: [shot('map.spec.ts', 'attic', '/head/desk.png', '/head/phone.png')] }],
    };
    const base: PlaywrightReport = {
      suites: [{ specs: [shot('map.spec.ts', 'attic', '/base/desk.png')] }],
    };

    expect(screenshots(head, { report: base, samePicture }).map((s) => s.title)).toEqual(['attic']);
  });

  it.each([
    { name: 'an unchanged end state is left out', headEnd: '/head/end_old.png', shown: [] },
    { name: 'a changed end state is shown', headEnd: '/head/end_new.png', shown: ['play a turn'] },
  ])('compare a flow by its end state: $name', ({ headEnd, shown }) => {
    const head: PlaywrightReport = {
      suites: [{ specs: [flow('play.spec.ts', 'play a turn', headEnd)] }],
    };
    const base: PlaywrightReport = {
      suites: [{ specs: [flow('play.spec.ts', 'play a turn', '/base/end_old.png')] }],
    };

    expect(changedFlows(head, { report: base, samePicture }).map((f) => f.title)).toEqual(shown);
  });

  it.each([
    { name: 'another file', baseSpec: shot('other.spec.ts', 'the attic', '/base/attic.png') },
    {
      name: 'the flow project',
      baseSpec: flow('map.spec.ts', 'the attic', '/base/attic.png'),
    },
  ])(
    'are matched by file, title and project, so a base spec in $name is no match',
    ({ baseSpec }) => {
      const head: PlaywrightReport = {
        suites: [{ specs: [shot('map.spec.ts', 'the attic', '/head/attic.png')] }],
      };
      const base: PlaywrightReport = { suites: [{ specs: [baseSpec] }] };

      expect(screenshots(head, { report: base, samePicture }).map((s) => s.title)).toEqual([
        'the attic',
      ]);
    },
  );
});

describe('joinReports', () => {
  it('puts the suites of every shard side by side, skipping a shard without any', () => {
    const shardOne: PlaywrightReport = { suites: [{ specs: [] }] };
    const brokenShard: PlaywrightReport = {};
    const shardThree: PlaywrightReport = { suites: [{ suites: [] }] };

    expect(joinReports([shardOne, brokenShard, shardThree])).toEqual({
      suites: [{ specs: [] }, { suites: [] }],
    });
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

  it('shows the desktop and phone screenshots side by side, cache-busted from the picture host, above the screencasts', () => {
    const section = renderSection({
      flows: [recorded],
      shots: [
        {
          title: 'Map tabs',
          slug: 'map-tabs',
          pictures: { desktop: '/wide.png', phone: '/narrow.png' },
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
        '<tr><th>Desktop</th><th>Phone</th></tr>',
        '<tr><td><img src="https://raw.x.test/s/map-tabs-desktop.png?v=abc123" alt="Desktop" width="560"></td>' +
          '<td><img src="https://raw.x.test/s/map-tabs-phone.png?v=abc123" alt="Phone" width="180"></td></tr>',
        '</table>',
      ].join('\n'),
    );
    expect(section.indexOf('## Screenshots')).toBeLessThan(section.indexOf('## Screencasts'));
  });

  it('notes a device whose screenshot failed next to the one that was taken', () => {
    const section = renderSection({
      flows: [],
      shots: [
        {
          title: 'Map tabs',
          slug: 'map-tabs',
          pictures: { desktop: '/wide.png', phone: undefined },
        },
      ],
      baseUrl: 'https://x.test/s',
      pictureBaseUrl: 'https://raw.x.test/s',
      version: 'abc123',
    });

    expect(section).toContain('map-tabs-desktop.png');
    expect(section).toContain('<td>Not taken: the spec failed, see the E2E check.</td>');
    expect(section).not.toContain('map-tabs-phone.png');
  });

  it('notes a failed screenshot instead of linking a missing file', () => {
    const section = renderSection({
      flows: [],
      shots: [
        { title: 'Map tabs', slug: 'map-tabs', pictures: { desktop: undefined, phone: undefined } },
      ],
      baseUrl: 'https://x.test/s',
      pictureBaseUrl: 'https://raw.x.test/s',
      version: 'abc123',
    });

    expect(section).toContain('Not taken');
    expect(section).not.toContain('<table>');
    expect(section).not.toContain('## Screencasts');
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

  it('is just the markers when the PR changes no picture', () => {
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
