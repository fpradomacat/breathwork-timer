// ── Sound controls ────────────────────────────────────────────
//
// Two ways to control the sound, sharing the same state:
//
//   1. The quick row of on/off buttons (.sound-toggle[data-sound]) that
//      stays available before and during a session.
//   2. The sound panel (🎚️ → #modal-sound): an on/off switch and a
//      volume slider per channel.
//
// Channels:
//   cues     → phase cues layer (loop.js 'breathing') — volume only, always on
//   breaths  → breathing sound layer (loop.js)
//   voice    → voice guide layer (loop.js)
//   ticks    → per-second tick layer (loop.js)
//   music    → ambient background music (audio.js)
//   ui       → interface clicks / chimes (audio.js)
//
// Saved in localStorage ("neyen.sound") as { channel: { on, vol } },
// vol being a factor of the default mix level (1 = 100 %).

import { ambient, setUiSounds } from './audio.js';
import { setLayerEnabled, setLayerVolume } from './loop.js';
import { i18n } from './i18n.js';
import { lang } from './ui.js';
import { load, save } from './storage.js';

const CHANNELS = [
  { key: 'cues', icon: '🔔', label: 'soundCues', toggle: false },
  { key: 'breaths', icon: '🌬️', label: 'soundBreaths' },
  { key: 'voice', icon: '🗣️', label: 'soundVoice' },
  { key: 'ticks', icon: '⏱️', label: 'soundTicks' },
  { key: 'music', icon: '🎵', label: 'soundMusic' },
  { key: 'ui', icon: '👆', label: 'soundUi' },
];
const DEFAULT_ON = {
  cues: true,
  breaths: true,
  voice: true,
  ticks: false,
  music: true,
  ui: true,
};
const MAX_VOLUME = 150; // slider max, in %

function _loadPrefs() {
  const saved = load('sound', {});
  const prefs = {};
  for (const { key } of CHANNELS) {
    const v = saved[key];
    // Older versions stored a plain boolean per channel
    if (typeof v === 'boolean') prefs[key] = { on: v, vol: 1 };
    else
      prefs[key] = {
        on: typeof v?.on === 'boolean' ? v.on : DEFAULT_ON[key],
        vol: Number.isFinite(v?.vol)
          ? Math.min(Math.max(v.vol, 0), MAX_VOLUME / 100)
          : 1,
      };
  }
  prefs.cues.on = true;
  return prefs;
}

const _prefs = _loadPrefs();
const _save = () => save('sound', _prefs);

/** Push one channel's state to the audio engine. */
function _applyAudio(key) {
  const { on, vol } = _prefs[key];
  switch (key) {
    case 'music':
      ambient.setVolume(vol);
      ambient.setMuted(!on);
      break;
    case 'ui':
      setUiSounds(on, vol);
      break;
    case 'cues':
      setLayerVolume('breathing', vol);
      break;
    default:
      setLayerVolume(key, vol);
      setLayerEnabled(key, on);
  }
}

/** Reflect one channel's state in the quick buttons and the panel. */
function _syncUI(key) {
  const { on, vol } = _prefs[key];
  const btn = document.querySelector(`.sound-toggle[data-sound="${key}"]`);
  if (btn) {
    btn.classList.toggle('off', !on);
    btn.setAttribute('aria-pressed', String(on));
  }
  const row = document.querySelector(`.mixer-row[data-sound="${key}"]`);
  if (row) {
    row.classList.toggle('off', !on);
    const sw = row.querySelector('.mixer-switch');
    sw?.setAttribute('aria-checked', String(on));
    const slider = row.querySelector('.mixer-slider');
    slider.value = Math.round(vol * 100);
    row.querySelector('.mixer-value').textContent = `${slider.value}%`;
  }
}

function _set(key, changes) {
  Object.assign(_prefs[key], changes);
  _applyAudio(key);
  _syncUI(key);
  _save();
}

/** Build the rows of the sound panel. */
function _renderMixer() {
  const t = i18n[lang];
  const list = document.getElementById('mixer-list');
  list.innerHTML = CHANNELS.map(
    ({ key, icon, label, toggle = true }) => `
    <div class="mixer-row" data-sound="${key}">
      <span class="mixer-icon" aria-hidden="true">${icon}</span>
      <label class="mixer-name" for="mix-${key}" data-i18n="${label}">${t[label]}</label>
      <input class="mixer-slider" id="mix-${key}" type="range" min="0" max="${MAX_VOLUME}" step="5">
      <span class="mixer-value" aria-hidden="true"></span>
      ${
        toggle
          ? `<button class="mixer-switch" role="switch" aria-labelledby="mixlabel-${key}"><span class="mixer-knob"></span></button>
             <span class="visually-hidden" id="mixlabel-${key}" data-i18n="${label}">${t[label]}</span>`
          : `<span class="mixer-always" data-i18n="soundAlwaysOn">${t.soundAlwaysOn}</span>`
      }
    </div>`,
  ).join('');

  list.querySelectorAll('.mixer-row').forEach((row) => {
    const key = row.dataset.sound;
    row.querySelector('.mixer-slider').addEventListener('input', (e) => {
      _set(key, { vol: Number(e.target.value) / 100 });
    });
    row.querySelector('.mixer-switch')?.addEventListener('click', () => {
      _set(key, { on: !_prefs[key].on });
    });
  });
}

/** Apply saved preferences and wire up the buttons and the panel. */
export function initSoundControls() {
  _renderMixer();
  for (const { key } of CHANNELS) {
    _applyAudio(key);
    _syncUI(key);
  }

  // No stopPropagation: if this is the user's first tap, the click must
  // still reach the document so ambient.bootstrap() can start the music.
  document.querySelectorAll('.sound-toggle[data-sound]').forEach((btn) => {
    const key = btn.dataset.sound;
    btn.addEventListener('click', () => {
      _set(key, { on: !_prefs[key].on });
      // Drop focus so Space keeps controlling the session, not this button
      btn.blur();
    });
  });
}
