// ── Technique loop audio ───────────────────────────────────────
//
// Each technique has three audio files, each exactly ONE breathing
// cycle long:
//   base loop   — clean, no voice cues
//   helper ES   — voiced cues in Spanish
//   helper EN   — voiced cues in English
//
// Flow:
//   1. The voiced helper plays for the first `helperCycles` cycles.
//   2. After that the clean base track takes over for the rest of the session.
//
// Timing (Web Audio path):
//   Instead of a native looping source (whose period is the file length,
//   which can differ by a few ms from the cycle length and drifts), each
//   cycle is scheduled as its own one-shot source at an exact time on the
//   AudioContext clock: t0 + n * cycleDur. The helper → base crossover is
//   therefore sample-accurate and stays locked to the session clock in
//   session.js, which uses the same AudioContext time as its master clock.
//
//   A small look-ahead scheduler (setTimeout) queues upcoming cycles a few
//   seconds in advance, so timer jitter never affects what you hear.

import { audioCtx } from './audio.js';

const SESSION_VOLUME = 0.55;
const LOOKAHEAD = 3; // seconds of audio scheduled ahead of currentTime
const SCHED_INTERVAL = 250; // ms between scheduler runs

// Decoded AudioBuffers for the currently loaded preset
let _buffers = { base: null, helper: null };

// HTMLAudioElement fallbacks (always available, work on file://)
let _fallbacks = { base: null, helper: null };

// Active Web Audio scheduler state (null when stopped)
//   { t0, cycleDur, next, timer, gain, sources: Set<AudioBufferSourceNode> }
let _sched = null;

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

/** Buffer to use for a given cycle index. */
function _bufferFor(cycle) {
  return cycle < _helperCycles
    ? _buffers.helper || _buffers.base
    : _buffers.base || _buffers.helper;
}

/** Queue every cycle that starts within the look-ahead window. */
function _pump() {
  const s = _sched;
  if (!s) return;

  const now = audioCtx.currentTime;
  while (s.t0 + s.next * s.cycleDur < now + LOOKAHEAD) {
    const when = s.t0 + s.next * s.cycleDur;
    const end = when + s.cycleDur;
    const buf = _bufferFor(s.next);
    s.next++;

    // Skip cycles that are already over (e.g. timers were throttled)
    if (!buf || end <= now) continue;

    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(s.gain);
    // If we're late, start mid-buffer so the audio stays phase-locked
    if (when >= now) src.start(when);
    else src.start(now, now - when);
    // Trim to exactly one cycle so a slightly-long file never overlaps
    // the next one (a slightly-short file just leaves a few ms of silence).
    src.stop(end);
    src.onended = () => s.sources.delete(src);
    s.sources.add(src);
  }

  s.timer = setTimeout(_pump, SCHED_INTERVAL);
}

function _playFallback(which) {
  if (_fallbackActive) {
    _fallbackActive.pause();
    _fallbackActive.currentTime = 0;
    _fallbackActive = null;
  }
  const fallback = _fallbacks[which];
  if (!fallback) return;
  fallback.currentTime = 0;
  fallback.play().catch(() => {});
  _fallbackActive = fallback;
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
 * Start the technique audio for a session.
 * @param {number} t0        — AudioContext time at which cycle 0 starts
 * @param {number} cycleDur  — length of one breathing cycle, in seconds
 */
export function startLoop(t0, cycleDur) {
  stopLoop();
  if (cycleDur <= 0) return;

  if (_buffers.base || _buffers.helper) {
    const gain = audioCtx.createGain();
    gain.gain.value = SESSION_VOLUME;
    gain.connect(audioCtx.destination);
    _sched = { t0, cycleDur, next: 0, timer: null, gain, sources: new Set() };
    _pump();
  } else {
    // Buffers not decoded (file:// or still loading) — HTMLAudio fallback
    _playFallback(_helperCycles > 0 ? 'helper' : 'base');
  }
}

/**
 * Notify that a cycle completed. Only the HTMLAudio fallback needs this
 * (to switch helper → base); the Web Audio path is pre-scheduled.
 * @param {number} cycles — completed cycle count
 */
export function updateLoop(cycles) {
  if (_fallbackActive && cycles === _helperCycles) _playFallback('base');
}

/** Stop whatever loop track is currently playing or scheduled. */
export function stopLoop() {
  if (_sched) {
    clearTimeout(_sched.timer);
    _sched.sources.forEach((src) => {
      try {
        src.stop();
      } catch (_) {}
    });
    _sched.gain.disconnect();
    _sched = null;
  }
  if (_fallbackActive) {
    _fallbackActive.pause();
    _fallbackActive.currentTime = 0;
    _fallbackActive = null;
  }
}
