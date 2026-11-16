// ── Storage ───────────────────────────────────────────────────
//
// Tiny localStorage wrapper. Every access is wrapped in try/catch:
// storage can be unavailable (private mode, blocked site data), and
// the app must keep working — preferences just won't persist.
//
// All keys are namespaced with "neyen.".

const PREFIX = 'neyen.';

/** Read a JSON value; returns `fallback` if missing or unreadable. */
export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Write a JSON value; silently ignored if storage is unavailable. */
export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore
  }
}
