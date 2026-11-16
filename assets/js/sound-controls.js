// ── Sound controls ────────────────────────────────────────────
//
// The row of on/off buttons (.sound-toggle[data-sound]) that stays
// available before and during a session:
//
//   music    → ambient background music (audio.js)
//   voice    → voice guide layer       (loop.js)
//   breaths  → breathing sound layer   (loop.js)
//   ticks    → per-second tick layer   (loop.js)
//
// The phase-cue layer ("breathing") is always on and has no button.
// Choices are remembered across visits in localStorage.

import { ambient } from './audio.js';
import { setLayerEnabled } from './loop.js';

const STORAGE_KEY = 'neyen.sound';
const DEFAULTS = { music: true, voice: true, breaths: true, ticks: false };

function _load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

function _save(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable (private mode, blocked) — preferences just won't persist
  }
}

const _prefs = _load();

function _apply(key, on) {
  if (key === 'music') ambient.setMuted(!on);
  else setLayerEnabled(key, on);

  const btn = document.querySelector(`.sound-toggle[data-sound="${key}"]`);
  if (btn) {
    btn.classList.toggle('off', !on);
    btn.setAttribute('aria-pressed', String(on));
  }
}

/** Apply saved preferences and wire up the toggle buttons. */
export function initSoundControls() {
  document.querySelectorAll('.sound-toggle').forEach((btn) => {
    const key = btn.dataset.sound;
    if (!(key in _prefs)) return;
    _apply(key, _prefs[key]);

    // No stopPropagation: if this is the user's first tap, the click must
    // still reach the document so ambient.bootstrap() can start the music.
    btn.addEventListener('click', () => {
      _prefs[key] = !_prefs[key];
      _apply(key, _prefs[key]);
      _save(_prefs);
      // Drop focus so Space keeps controlling the session, not this button
      btn.blur();
    });
  });
}
