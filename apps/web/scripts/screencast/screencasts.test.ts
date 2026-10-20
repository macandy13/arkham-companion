import { describe, expect, it } from 'vitest';
import {
  SECTION_END,
  SECTION_START,
  flowVideos,
  gifArgs,
  renderSection,
  replaceSection,
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
          specs: [{ title: 'First flow', tests: [{ results: [result('passed', '/a.webm')] }] }],
          suites: [
            {
              specs: [
                { title: 'Second flow', tests: [{ results: [result('passed', '/b.webm')] }] },
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
      suites: [{ specs: [{ title: 'Flow', tests: [{ results }] }] }],
    };

    const [flow] = flowVideos(report);

    expect(flow?.videoPath).toBe(video);
  });

  it('returns nothing for an empty report', () => {
    expect(flowVideos({})).toEqual([]);
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
  it('samples one frame per 250 ms step and loops forever', () => {
    const args = gifArgs({ input: 'in.webm', output: 'out.gif' });

    expect(args.slice(-3)).toEqual(['-loop', '0', 'out.gif']);
    expect(args[args.indexOf('-i') + 1]).toBe('in.webm');
    expect(args[args.indexOf('-vf') + 1]).toMatch(/^fps=4,scale=800:-1/);
  });
});

describe('renderSection', () => {
  const recorded = { title: 'Create a game', slug: 'create-a-game', videoPath: '/v.webm' };
  const failed = { title: 'Broken flow', slug: 'broken-flow', videoPath: undefined };

  it('embeds a cache-busted GIF and links the video for a recorded flow', () => {
    const section = renderSection({
      flows: [recorded],
      baseUrl: 'https://x.test/s',
      version: 'abc123',
    });

    expect(section).toContain('![Create a game](https://x.test/s/create-a-game.gif?v=abc123)');
    expect(section).toContain('[Full-quality video](https://x.test/s/create-a-game.webm?v=abc123)');
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
