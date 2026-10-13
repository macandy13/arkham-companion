import { useSyncExternalStore } from 'react';

/** Minimal observable store: `getState`/`setState`/`subscribe`, compatible with React's `useSyncExternalStore`. */
export interface Store<T> {
  getState(): T;
  /** Shallow-merges a partial state and notifies subscribers. */
  setState(partial: Partial<T>): void;
  subscribe(listener: () => void): () => void;
}

/**
 * Creates a store from an initialiser that receives `set`/`get`. Kept in-house
 * (about 20 lines) instead of pulling in a state library; the app store is the only user.
 */
export function createStore<T>(init: (set: Store<T>['setState'], get: () => T) => T): Store<T> {
  let state: T;
  const listeners = new Set<() => void>();
  const setState: Store<T>['setState'] = (partial) => {
    state = { ...state, ...partial };
    listeners.forEach((l) => l());
  };
  state = init(setState, () => state);
  return {
    getState: () => state,
    setState,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** React hook selecting a slice of a store; re-renders when the selected value changes. */
export function useStoreSelector<T, S>(store: Store<T>, select: (state: T) => S): S {
  return useSyncExternalStore(store.subscribe, () => select(store.getState()));
}
