import { describe, expect, it } from 'vitest';
import {
  SECTION_END,
  SECTION_START,
  flowVideos,
  gifArgs,
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
  it('collects specs from nested suites in report order', () => {
    const report: PlaywrightReport = {
      suites: [
        {
          specs: [
            {
              title: 'First flow',
              tests: [{ projectName: 'screencast', results: [result('passed', '/a.webm')] }],
            },
          ],
          suites: [
            {
              specs: [
                {
                  title: 'Second flow',
                  tests: [{ projectName: 'screencast', results: [result('passed', '/b.webm')] }],
                },
              ],
            },
          ],
        },
      ],
    };

    const flows = flowVideos(report);

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
      suites: [{ specs: [{ title: 'Flow', tests: [{ projectName: 'screencast', results }] }] }],
    };

    const [flow] = flowVideos(report);

    expect(flow?.videoPath).toBe(video);
  });

  it('returns nothing for an empty report', () => {
    expect(flowVideos({})).toEqual([]);
  });
});

describe('screenshots', () => {
  it('reads each spec from its own project: screenshots from screenshot, videos from screencast', () => {
    const report: PlaywrightReport = {
      suites: [
        {
          specs: [
            {
              title: 'Read the map',
              tests: [{ projectName: 'screencast', results: [result('passed', '/map.webm')] }],
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
      { title: 'Map tabs', slug: 'map-tabs', imagePath: '/tabs.png' },
    ]);
    expect(flowVideos(report)).toEqual([
      { title: 'Read the map', slug: 'read-the-map', videoPath: '/map.webm' },
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

  it('embeds a cache-busted GIF and links the player for a recorded flow', () => {
    const section = renderSection({
      flows: [recorded],
      baseUrl: 'https://x.test/s',
      version: 'abc123',
    });

    expect(section).toContain('![Create a game](https://x.test/s/create-a-game.gif?v=abc123)');
    expect(section).toContain(
      '[Play with pause and speed controls](https://x.test/s/player.html?flow=create-a-game&v=abc123&speed=0.25)',
    );
  });

  it('embeds a cache-busted screenshot above the screencasts', () => {
    const section = renderSection({
      flows: [recorded],
      shots: [{ title: 'Map tabs', slug: 'map-tabs', imagePath: '/tabs.png' }],
      baseUrl: 'https://x.test/s',
      version: 'abc123',
    });

    expect(section).toContain('![Map tabs](https://x.test/s/map-tabs.png?v=abc123)');
    expect(section.indexOf('## Screenshots')).toBeLessThan(section.indexOf('## Screencasts'));
  });

  it('notes a failed screenshot instead of linking a missing file', () => {
    const section = renderSection({
      flows: [],
      shots: [{ title: 'Map tabs', slug: 'map-tabs', imagePath: undefined }],
      baseUrl: 'https://x.test/s',
      version: 'abc123',
    });

    expect(section).toContain('Not taken');
    expect(section).not.toContain('map-tabs.png');
    expect(section).not.toContain('## Screencasts');
  });

  it('is just the markers when no flow is tagged', () => {
    const section = renderSection({ flows: [], baseUrl: 'https://x.test/s', version: 'abc123' });

    expect(section).toBe('<!-- screencasts:start -->\n<!-- screencasts:end -->');
  });

  it('notes a failed flow instead of linking a missing file', () => {
    const section = renderSection({
      flows: [failed],
      baseUrl: 'https://x.test/s/',
      version: 'abc123',
    });

    expect(section).toContain('### Broken flow');
    expect(section).toContain('Not recorded');
    expect(section).not.toContain('broken-flow.gif');
  });

  it('is wrapped in the section markers', () => {
    const section = renderSection({ flows: [], baseUrl: 'https://x.test/s/', version: 'abc123' });

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
