import { describe, expect, it } from 'vitest';
import { escapeHtml, highlightLine } from './highlight.ts';

describe('highlightLine', () => {
  it.each([
    [
      'a keyword and a type',
      'const x: CardCode',
      '<span class="k">const</span> x: <span class="t">CardCode</span>',
    ],
    ['a string', "kind: 'basic'", `kind: <span class="s">'basic'</span>`],
    ['a line comment', 'x(); // why', 'x(); <span class="c">// why</span>'],
    ['a doc comment line', '   * The groups', '<span class="c">   * The groups</span>'],
    ['markup, escaped', '<WholeCard />', '&lt;<span class="t">WholeCard</span> /&gt;'],
    ['an arrow and a division', 'a => b / 2', 'a =&gt; b / 2'],
  ])('colours %s', (_case, line, html) => {
    expect(highlightLine(line)).toBe(html);
  });
});

describe('escapeHtml', () => {
  it('escapes markup and double quotes', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
});
