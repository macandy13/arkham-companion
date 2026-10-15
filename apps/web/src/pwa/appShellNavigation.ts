/**
 * The page navigations the service worker may answer with the cached `index.html`
 * (Workbox `navigateFallbackAllowlist`, configured in `vite.config.ts`).
 *
 * The app uses hash routing, so the shell only ever needs to serve the base path itself.
 * Workbox's default (every navigation in scope) also swallowed links to plain files next to
 * the app, such as the PR screencast videos under `screencasts/`, and – for the deployment
 * at the site root – the PR previews under `pr-preview/`, which all opened the app instead.
 */
export function appShellNavigation(base: string): RegExp {
  const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escapedBase}(index\\.html)?(\\?.*)?$`);
}
