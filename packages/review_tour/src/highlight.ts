/** Escapes text for HTML content and double-quoted attributes. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (char) => ESCAPES[char] ?? char);
}

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

const KEYWORDS = new Set(
  'as async await case const default else export false for from function if import interface let new null readonly return switch throw true type undefined void'.split(
    ' ',
  ),
);

/** Comment, string, capitalised name (a type or component), other word, anything else. */
const TOKEN =
  /(\/\/.*$|^\s*\*.*$|\/\*.*?\*\/)|('(?:[^'\\]|\\.)*'?|"(?:[^"\\]|\\.)*"?|`[^`]*`?)|\b([A-Z]\w*)\b|(\w+)|([^\w'"`/]+|\/)/g;

/**
 * Colours one line of TypeScript as HTML spans (`c` comment, `s` string, `t` type, `k`
 * keyword). Line by line and approximate: the page shows a few lines per stop, and a token
 * that spans lines just stays plain.
 */
export function highlightLine(line: string): string {
  return [...line.matchAll(TOKEN)]
    .map(([token, comment, string, type, word]) => {
      if (comment !== undefined) return span('c', token);
      if (string !== undefined) return span('s', token);
      if (type !== undefined) return span('t', token);
      if (word !== undefined && KEYWORDS.has(word)) return span('k', token);
      return escapeHtml(token);
    })
    .join('');
}

function span(kind: 'c' | 's' | 't' | 'k', token: string): string {
  return `<span class="${kind}">${escapeHtml(token)}</span>`;
}
