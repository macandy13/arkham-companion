/**
 * The review page's stylesheet and script, inlined by `renderPage` so the page is one file.
 * The look is deliberately its own, plain and quiet, not the app's: the page is read once on a
 * phone, and only the question is tinted so it is what the eye lands on.
 */
export const PAGE_CSS = `
:root {
  --bg: #fbfbf9; --fg: #1d1f21; --muted: #6b6f73; --line: #e6e5e0; --soft: #f2f1ec;
  --accent: #2f5d8a; --accent-fg: #ffffff; --ask: #fdf4dc; --ask-fg: #3d3115; --code-bg: #ffffff;
  --add-bg: #e9f5ec; --add-mark: #2e7d47; --del-bg: #fbecea; --del-mark: #b0413a; --hl: #fff3c4;
  --tok-key: #8a3ffc; --tok-str: #2e7d47; --tok-com: #8c9196; --tok-type: #2f5d8a; --ok: #2e7d47;
  --font-body: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-code: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
  --radius: 8px;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #17191b; --fg: #e8e8e6; --muted: #9a9ea3; --line: #2b2e31; --soft: #202326;
    --accent: #8ab4e0; --accent-fg: #10161c; --ask: #2b2617; --ask-fg: #f0e3bd; --code-bg: #1c1f22;
    --add-bg: #1d2e23; --add-mark: #7cc596; --del-bg: #33201f; --del-mark: #e48a83; --hl: #3a3420;
    --tok-key: #c4a1ff; --tok-str: #8fd0a4; --tok-com: #7c8288; --tok-type: #8ab4e0; --ok: #7cc596;
    color-scheme: dark;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 var(--font-body); -webkit-font-smoothing: antialiased; }
main {
  max-width: 720px; margin: 0 auto; display: grid; gap: 40px;
  padding: 0 max(16px, env(safe-area-inset-right)) 56px max(16px, env(safe-area-inset-left));
}
a { color: var(--accent); text-underline-offset: 2px; }
a:focus-visible, button:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
code { font-family: var(--font-code); font-size: .88em; background: var(--soft); padding: 1px 5px; border-radius: 4px; }
nav {
  position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 12px;
  margin: 0 calc(-1 * max(16px, env(safe-area-inset-left))); padding: 10px max(16px, env(safe-area-inset-left));
  background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line);
}
nav .number { font-size: 14px; font-weight: 600; color: var(--muted); }
nav ol { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 0 auto; padding: 0; list-style: none; }
nav ol a {
  width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
  color: var(--muted); background: var(--soft); font-size: 13px; font-weight: 600; text-decoration: none;
}
nav ol a.question { background: var(--ask); color: var(--ask-fg); }
nav ol a.on { background: var(--accent); color: var(--accent-fg); }
header { display: grid; gap: 12px; padding-top: 28px; }
.kicker { font-size: 13px; color: var(--muted); }
h1 { font-size: 28px; line-height: 1.2; font-weight: 650; letter-spacing: -0.015em; margin: 0; text-wrap: balance; }
.concept { font-size: 18px; margin: 0; max-width: 60ch; }
.meta { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 13px; color: var(--muted); margin: 0; }
.questions { background: var(--ask); color: var(--ask-fg); border-radius: var(--radius); padding: 18px 20px; display: grid; gap: 14px; }
.questions h2 { font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; margin: 0; opacity: .75; }
.questions ol { margin: 0; padding-left: 20px; display: grid; gap: 12px; }
.questions p { margin: 0; font-size: 17px; }
.questions .about { font-size: 13px; opacity: .75; }
.questions a { color: inherit; font-size: 14px; font-weight: 500; }
.stop { display: grid; gap: 14px; scroll-margin-top: 64px; }
.stop > header { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; align-items: center; padding: 0; }
.stop-number {
  grid-row: span 2; align-self: start; margin-top: 2px; width: 28px; height: 28px; border-radius: 50%;
  display: grid; place-items: center; background: var(--accent); color: var(--accent-fg); font-size: 13px; font-weight: 600;
}
.stop h2 { font-size: 20px; line-height: 1.3; font-weight: 600; letter-spacing: -0.01em; margin: 0; text-wrap: balance; }
.tag { font-size: 12px; color: var(--muted); letter-spacing: .04em; text-transform: uppercase; }
.stop > p { margin: 0; max-width: 62ch; }
figure { display: grid; gap: 8px; margin: 0; }
.toggle { display: flex; flex-wrap: wrap; gap: 4px; }
.segments { display: inline-flex; background: var(--soft); border-radius: 999px; padding: 3px; }
.toggle button { font: 500 13px var(--font-body); color: var(--muted); background: transparent; border: 0; border-radius: 999px; padding: 4px 12px; cursor: pointer; }
.toggle button[aria-pressed="true"] { background: var(--bg); color: var(--fg); box-shadow: 0 1px 2px rgb(0 0 0 / 12%); }
.frame { border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; background: var(--soft); }
.frame img { display: block; width: 100%; height: auto; }
.frame.phone { max-width: 280px; margin-inline: auto; }
.frame .missing { padding: 24px; text-align: center; color: var(--muted); font-size: 14px; }
.code { border: 1px solid var(--line); border-radius: var(--radius); background: var(--code-bg); overflow: hidden; }
.code > header {
  display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; padding: 8px 12px;
  border-bottom: 1px solid var(--line); background: var(--soft); font-size: 13px; color: var(--muted);
}
.code .file { color: var(--fg); font-family: var(--font-code); font-size: 12.5px; overflow-wrap: anywhere; }
.code > header a { margin-left: auto; }
.code pre code { display: block; padding: 0; background: none; font-size: inherit; }
.code pre { margin: 0; padding: 6px 0; font: 12.5px/1.6 var(--font-code); font-variant-ligatures: none; }
.line { display: grid; grid-template-columns: 3.2em 1.4em minmax(0, 1fr); }
.line .number { color: var(--muted); text-align: right; padding-right: .6em; user-select: none; opacity: .6; }
.line .mark { color: var(--muted); user-select: none; }
.line .text { padding: 0 12px 0 2ch; text-indent: -2ch; white-space: pre-wrap; overflow-wrap: anywhere; }
.line.added { background: var(--add-bg); } .line.added .mark { color: var(--add-mark); }
.line.removed { background: var(--del-bg); } .line.removed .mark { color: var(--del-mark); }
.line.highlighted { background: var(--hl); }
.line.gap .text { color: var(--muted); font-family: var(--font-body); font-size: 12px; }
.k { color: var(--tok-key); } .s { color: var(--tok-str); } .c { color: var(--tok-com); font-style: italic; } .t { color: var(--tok-type); }
.done { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; }
.done p { margin: 0; color: var(--muted); }
.done a { background: var(--accent); color: var(--accent-fg); border-radius: 999px; padding: 9px 20px; text-decoration: none; font-weight: 600; font-size: 15px; }
details { border-top: 1px solid var(--line); padding-top: 16px; }
summary { cursor: pointer; font-size: 15px; font-weight: 600; }
details ul { padding-left: 20px; margin: 12px 0 0; display: grid; gap: 6px; font-size: 15px; }
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
`;

/**
 * Switches a stop's picture between before and after and between devices (the variants sit in
 * the figure's \`data-variants\`), and marks the stop being read in the top bar.
 */
export const PAGE_SCRIPT = `
document.querySelectorAll('figure[data-variants]').forEach((figure) => {
  const variants = JSON.parse(figure.dataset.variants);
  const state = { when: 'after', device: variants[0].device };
  const frame = figure.querySelector('.frame');
  const show = () => {
    const variant = variants.find((v) => v.device === state.device);
    const src = variant[state.when];
    frame.classList.toggle('phone', state.device === 'phone');
    frame.innerHTML = src
      ? '<img alt="' + state.device + ', ' + state.when + '" src="' + src + '">'
      : '<p class="missing">' + (state.when === 'before' ? 'New in this PR' : 'Removed in this PR') + '</p>';
    figure.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.value === state.when || b.value === state.device)));
  };
  figure.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    state[b.name] = b.value;
    show();
  }));
  show();
});
const dots = [...document.querySelectorAll('nav a[data-stop]')];
const seen = new IntersectionObserver((entries) => entries.forEach((entry) => {
  if (entry.isIntersecting) dots.forEach((d) => d.classList.toggle('on', d.dataset.stop === entry.target.id));
}), { rootMargin: '-40% 0px -55% 0px' });
document.querySelectorAll('.stop').forEach((stop) => seen.observe(stop));
`;
