import { useSyncExternalStore } from 'react';

/**
 * The phone layout's media query: a phone held upright. The stylesheets' phone blocks (tokens.css,
 * game.css, investigators.css) write out the same query, since CSS cannot read this constant.
 */
const PHONE_QUERY = '(orientation: portrait) and (max-width: 40rem)';

/**
 * Whether the screen is a phone held upright (`PHONE_QUERY`), following it as the phone turns.
 * Only what a tap does differs on a phone (it opens the detail view); the layout itself is CSS.
 * False where the browser has no `matchMedia`, as in unit tests.
 */
export function usePhone(): boolean {
  return useSyncExternalStore(subscribe, matches, () => false);
}

function phoneQuery(): MediaQueryList | undefined {
  return typeof window.matchMedia === 'function' ? window.matchMedia(PHONE_QUERY) : undefined;
}

function subscribe(onChange: () => void): () => void {
  const query = phoneQuery();
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

function matches(): boolean {
  return phoneQuery()?.matches ?? false;
}
