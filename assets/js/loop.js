// ── Technique loop audio ───────────────────────────────────────
//
// Each technique has three audio files:
//   base loop   — clean, no voice cues
//   helper ES   — voiced cues in Spanish
//   helper EN   — voiced cues in English
//
// Flow:
//   1. On session start the voiced helper loops for `helperCycles` cycles.
//   2. After that the clean base loop takes over for the rest of the session.
//
// The crossover is driven by the `cycles` counter from session.js —
// no separate timing needed here.

import { audioCtx } from './audio.js';

const SESSION_VOLUME = 0.55;

// Decoded AudioBuffers for the currently loaded preset
let _buffers = { base: null, helper: null };

// HTMLAudioElement fallbacks (always available, work on file://)
let _fallbacks = { base: null, helper: null };

// Active Web Audio nodes (null when stopped)
let _source = null;
let _gain = null;

// Active HTMLAudioElement fallback (null when using Web Audio)
let _fallbackActive = null;

// Which preset is currently loaded (avoids redundant fetches)
let _loadedPreset = null;

// Helper cycle count for the active preset
let _helperCycles = 3;

// Saving fetched sources to reduce http calls
let fetchedSources = null;

// ── Internal helpers ──────────────────────────────────────────

/** Decode an audio file into an AudioBuffer; returns null on any error. */
async function _decode(src) {
  if (fetchedSources?.[src]) {
    return fetchedSources?.[src];
  } else {
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(res.status);
      if (fetchedSources === null) fetchedSources = {};
      fetchedSources[src] = await audioCtx.decodeAudioData(await res.arrayBuffer());
      return fetchedSources[src];
    } catch {
      return null;
    }
  }
}

function _makeFallback(src) {
  if (!src) return null;
  const a = new Audio(src);
  a.loop = true;
  a.preload = 'auto';
  a.volume = SESSION_VOLUME;
  a.load();
  return a;
}

/** Start looping one track. Stops whatever is currently playing first. */
function _playTrack(which) {
  stopLoop();
  const buf = _buffers[which];
  const fallback = _fallbacks[which];

  if (buf) {
    // Web Audio path — gapless, Bluetooth-safe
    _gain = audioCtx.createGain();
    _gain.gain.value = SESSION_VOLUME;
    _gain.connect(audioCtx.destination);
    _source = audioCtx.createBufferSource();
    _source.buffer = buf;
    _source.loop = true;
    _source.connect(_gain);
    _source.start();
  } else if (fallback) {
    // HTMLAudioElement fallback
    fallback.currentTime = 0;
    fallback.play().catch(() => {});
    _fallbackActive = fallback;
  }
}

// ── Public API ────────────────────────────────────────────────

/**
 * Pre-load all audio files for a preset.
 * Safe to call multiple times — skips reload if already loaded.
 * @param {object} preset  — entry from PRESETS
 * @param {string} lang    — 'es' | 'en'
 */
export async function loadTechniqueLoops(preset, lang) {
  if (preset === _loadedPreset) return;
  _loadedPreset = preset;
  _helperCycles = preset.helperCycles ?? 3;

  const helperSrc = lang === 'es' ? preset.soundFileEs : preset.soundFileEn;

  // HTMLAudioElement fallbacks — immediate, no async needed
  _fallbacks.base = _makeFallback(preset.soundFile);
  _fallbacks.helper = _makeFallback(helperSrc);

  // Web Audio decode — http/https only
  if (location.protocol === 'file:') return;
  const [base, helper] = await Promise.all([
    _decode(preset.soundFile),
    _decode(helperSrc),
  ]);

  // Discard if the user switched technique while we were decoding
  if (preset !== _loadedPreset) return;
  _buffers.base = base;
  _buffers.helper = helper;
}

/**
 * Force reload on next call to loadTechniqueLoops.
 * Call this when the language changes so the helper track updates.
 */
export function invalidateLoopCache() {
  _loadedPreset = null;
}

/**
 * Decide which track to play based on current cycle count.
 * Called from startTimer() and after each completed cycle.
 * @param {number} cycles — current session cycle count
 */
export function updateLoop(cycles) {
  const which = cycles < _helperCycles ? 'helper' : 'base';

  // Already playing something — only act on the helper→base crossover
  if (_source || _fallbackActive) {
    if (cycles === _helperCycles) _playTrack('base');
    return;
  }

  // Nothing playing yet (first call from startTimer)
  _playTrack(which);
}

/** Stop whatever loop track is currently playing. */
export function stopLoop() {
  if (_source) {
    try {
      _source.stop();
    } catch (_) {}
    _source = null;
  }
  if (_gain) {
    _gain.disconnect();
    _gain = null;
  }
  if (_fallbackActive) {
    _fallbackActive.pause();
    _fallbackActive.currentTime = 0;
    _fallbackActive = null;
  }
}
