// Test setup — loaded with `node --test --import ./test/setup.mjs`.
//
// The app modules run in the browser. For unit tests:
//   - './audio.js' is swapped for a mock with a controllable clock
//     (see mock-audio.mjs), so loop.js can be tested without Web Audio
//   - localStorage is an in-memory Map

import { registerHooks } from 'node:module';

const MOCK_AUDIO = new URL('./mock-audio.mjs', import.meta.url).href;

registerHooks({
  resolve(specifier, context, next) {
    if (
      specifier === './audio.js' &&
      context.parentURL?.includes('/assets/js/')
    )
      return { url: MOCK_AUDIO, shortCircuit: true };
    return next(specifier, context);
  },
});

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
