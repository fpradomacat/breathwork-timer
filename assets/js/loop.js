// ── Technique audio (layered) ─────────────────────────────────
//
// Each technique has its own folder under /assets/sounds/<dir>/ with
// one file per layer, each exactly ONE breathing cycle long:
//
//   <dir>-breathing.mp3   phase cues (inhale / hold / exhale)  — always on
//   <dir>-breaths.mp3     the sound of the breathing itself    — toggleable
//   <dir>-voice-es.mp3    voice guide, Spanish                 — toggleable
//   <dir>-voice-en.mp3    voice guide, English                 — toggleable
//
// Plus a generated layer:
//   ticks                 a soft tick on every second          — toggleable
//
// Timing:
//   Every cycle of every layer is scheduled as a one-shot source at an
//   exact time on the AudioContext clock: t0 + n * cycleDur. All layers
//   therefore stay sample-locked to each other and to the session clock
//   in session.js (which uses the same AudioContext time). A small
//   look-ahead scheduler queues upcoming cycles a few seconds in advance.
//
// On / off:
//   Layers are always scheduled; each one goes through its own GainNode
//   and toggling just fades that gain. Toggling is instant and never
//   re-syncs anything.
//
// Voice rules:
//   - By default the voice guides the first `helperCycles` cycles, then stops.
//   - Turning it on manually AFTER that keeps it on for the rest of the session.

import { audioCtx } from './audio.js';

// Mix levels per layer (the files are exported at their relative mix levels)
const LAYER_VOLUME = {
  breathing: 0.55,
  breaths: 0.55,
  voice: 0.55,
  ticks: 0.18,
};
const TOGGLE_FADE = 0.15; // seconds
const LOOKAHEAD = 3; // seconds of audio scheduled ahead of currentTime
const SCHED_INTERVAL = 250; // ms between scheduler runs
const LOAD_TIMEOUT = 4000; // ms — max wait for audio before a session starts anyway

// User on/off state for the toggleable layers (set by sound-controls.js)
const _enabled = { breaths: true, voice: true, ticks: false };
// User volume factor per layer (1 = default mix level)
const _volume = { breathing: 1, breaths: 1, voice: 1, ticks: 1 };

// Decoded AudioBuffers for the currently loaded preset + language
let _buffers = { breathing: null, breaths: null, voice: null };

let _loadedPreset = null;
let _loadedLang = null;
let _loading = Promise.resolve();
let _helperCycles = 3;

// Decode cache: src → Promise<AudioBuffer|null>
const _cache = new Map();

// Active scheduler state (null when stopped)
//   { t0, cycleDur, next, timer, gains, sources, voiceKeep, voiceCycles }
let _sched = null;

// ── Internal helpers ──────────────────────────────────────────

function _decode(src) {
  if (!_cache.has(src)) {
    const p = fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(res.status);
        return res.arrayBuffer();
      })
      .then((data) => audioCtx.decodeAudioData(data))
      .catch(() => {
        _cache.delete(src); // allow a retry later
        return null;
      });
    _cache.set(src, p);
  }
  return _cache.get(src);
}

function _soundPath(preset, layer) {
  const dir = preset.soundDir;
  return `assets/sounds/${dir}/${dir}-${layer}.mp3`;
}

// Generated tick: short, soft sine "tock" with a fast decay
let _tickBuf = null;
function _tickBuffer() {
  if (_tickBuf) return _tickBuf;
  const sr = audioCtx.sampleRate;
  const len = Math.floor(sr * 0.05);
  const buf = audioCtx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    data[i] = Math.sin(2 * Math.PI * 1500 * t) * Math.exp(-t * 110);
  }
  return (_tickBuf = buf);
}

/**
 * Schedule `buf` to play in [when, end) through `gain`.
 * If `when` is already past, starts mid-buffer so it stays phase-locked.
 * Returns true if something was scheduled.
 */
function _play(s, buf, gain, when, end, now) {
  if (!buf || end <= now) return false;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect(gain);
  if (when >= now) src.start(when);
  else src.start(now, now - when);
  // Trim to the slot so a slightly-long file never overlaps the next one
  src.stop(end);
  src.onended = () => s.sources.delete(src);
  s.sources.add(src);
  return true;
}

function _scheduleVoice(s, cycle, now) {
  if (s.voiceCycles.has(cycle)) return;
  const when = s.t0 + cycle * s.cycleDur;
  if (_play(s, _buffers.voice, s.gains.voice, when, when + s.cycleDur, now))
    s.voiceCycles.add(cycle);
}

function _scheduleCycle(s, cycle, now) {
  const when = s.t0 + cycle * s.cycleDur;
  const end = when + s.cycleDur;

  _play(s, _buffers.breathing, s.gains.breathing, when, end, now);
  _play(s, _buffers.breaths, s.gains.breaths, when, end, now);
  if (cycle < _helperCycles || s.voiceKeep) _scheduleVoice(s, cycle, now);

  const tick = _tickBuffer();
  for (let k = 0; k < s.cycleDur; k++) {
    _play(s, tick, s.gains.ticks, when + k, when + k + tick.duration, now);
  }
}

/** Queue every cycle that starts within the look-ahead window. */
function _pump() {
  const s = _sched;
  if (!s) return;
  const now = audioCtx.currentTime;
  while (s.t0 + s.next * s.cycleDur < now + LOOKAHEAD) {
    _scheduleCycle(s, s.next, now);
    s.next++;
  }
  s.timer = setTimeout(_pump, SCHED_INTERVAL);
}

function _layerTarget(layer) {
  const on = layer === 'breathing' || _enabled[layer];
  return on ? LAYER_VOLUME[layer] * _volume[layer] : 0;
}

/** Fade a running layer's gain to its current target. */
function _rampLayer(s, layer, seconds = TOGGLE_FADE) {
  const now = audioCtx.currentTime;
  const g = s.gains[layer].gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(_layerTarget(layer), now + seconds);
}

// ── Public API ────────────────────────────────────────────────

/**
 * Load (fetch + decode) all layers for a preset in the given language.
 * Safe to call repeatedly — reuses the in-flight / finished load.
 * @param {object} preset — entry from PRESETS
 * @param {string} lang   — 'es' | 'en'
 * @returns {Promise<void>}
 */
export function loadTechniqueLoops(preset, lang) {
  if (preset === _loadedPreset && lang === _loadedLang) return _loading;
  _loadedPreset = preset;
  _loadedLang = lang;
  _helperCycles = preset.helperCycles ?? 3;

  _loading = Promise.all([
    _decode(_soundPath(preset, 'breathing')),
    _decode(_soundPath(preset, 'breaths')),
    _decode(_soundPath(preset, `voice-${lang}`)),
  ]).then(([breathing, breaths, voice]) => {
    // Discard if the user switched technique/language while decoding
    if (preset !== _loadedPreset || lang !== _loadedLang) return;
    _buffers = { breathing, breaths, voice };
  });
  return _loading;
}

/**
 * Resolves once the current technique's audio is decoded
 * (or after LOAD_TIMEOUT, so a slow network never blocks a session).
 */
export function loopsReady() {
  return Promise.race([
    _loading,
    new Promise((r) => setTimeout(r, LOAD_TIMEOUT)),
  ]);
}

/**
 * Start the technique audio for a session.
 * @param {number} t0       — AudioContext time at which cycle 0 starts
 * @param {number} cycleDur — length of one breathing cycle, in seconds
 */
export function startLoop(t0, cycleDur) {
  stopLoop();
  if (cycleDur <= 0) return;

  const gains = {};
  for (const layer of Object.keys(LAYER_VOLUME)) {
    const g = audioCtx.createGain();
    g.gain.value = _layerTarget(layer);
    g.connect(audioCtx.destination);
    gains[layer] = g;
  }

  _sched = {
    t0,
    cycleDur,
    next: 0,
    timer: null,
    gains,
    sources: new Set(),
    voiceKeep: false, // true once the user turns the voice on after the guided cycles
    voiceCycles: new Set(), // cycles that already have a voice source scheduled
  };
  _pump();
}

/**
 * Stop everything currently playing or scheduled.
 * @param {number} [fade=0] — seconds to fade out before stopping
 */
export function stopLoop(fade = 0) {
  const s = _sched;
  if (!s) return;
  _sched = null;
  clearTimeout(s.timer);

  const now = audioCtx.currentTime;
  if (fade > 0) {
    Object.values(s.gains).forEach((g) => {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + fade);
    });
  }
  s.sources.forEach((src) => {
    try {
      src.stop(now + fade);
    } catch (_) {}
  });
  setTimeout(
    () => Object.values(s.gains).forEach((g) => g.disconnect()),
    fade * 1000 + 100,
  );
}

/**
 * Turn a toggleable layer on or off ('breaths' | 'voice' | 'ticks').
 * Works before or during a session.
 */
export function setLayerEnabled(layer, on) {
  if (!(layer in _enabled)) return;
  _enabled[layer] = on;

  const s = _sched;
  if (!s) return;

  const now = audioCtx.currentTime;
  _rampLayer(s, layer);

  if (layer === 'voice') {
    if (!on) {
      s.voiceKeep = false;
      return;
    }
    // Turned on after the guided cycles → keep it on for the rest of the
    // session, and back-fill the cycles that are already scheduled.
    const current = Math.max(0, Math.floor((now - s.t0) / s.cycleDur));
    if (current >= _helperCycles) {
      s.voiceKeep = true;
      for (let c = current; c < s.next; c++) _scheduleVoice(s, c, now);
    }
  }
}

/**
 * Scale a layer's volume (1 = default mix level). Works before or during
 * a session; 'breathing' (phase cues) can be scaled but not turned off.
 */
export function setLayerVolume(layer, factor) {
  if (!(layer in _volume)) return;
  _volume[layer] = factor;
  if (_sched) _rampLayer(_sched, layer, 0.05);
}
