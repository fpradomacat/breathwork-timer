// ── Session ───────────────────────────────────────────────────
//
// Owns all the breathing session state and timing:
//   - isRunning flag
//   - session clock (setTimeout chain)
//   - phase countdown (rAF — purely visual)
//   - breathing cycle phases
//   - wake lock
//   - keep-alive oscillator (prevents AudioContext suspension on Bluetooth)
//
// Timing strategy:
//   All critical timing (phase advances, session counter, limit checks)
//   runs on plain setTimeout chains.  setTimeout keeps firing even when
//   the browser tab is in the background or the screen is off — unlike
//   requestAnimationFrame, which is paused by every mobile browser.
//
//   rAF is used only for the phase countdown number inside the circle
//   (purely cosmetic). If it pauses, the number just stops updating;
//   the phase still ends at the right time because _phaseTimer fires.

import { i18n } from './i18n.js';
import {
  audioCtx,
  resumeAudio,
  playStartSound,
  playStopTone,
} from './audio.js';
import { updateLoop, stopLoop } from './loop.js';
import {
  lang,
  checkLimit,
  formatTime,
  setCircleState,
  showToast,
} from './ui.js';

// ── Session state (module-private) ───────────────────────────
let _isRunning = false;
let _cycles = 0;
let _totalSecs = 0;
let _sessionTimer = null; // setTimeout — ticks every 1 s
let _phaseTimer = null; // setTimeout — fires when a phase ends
let _displayRAF = null; // rAF — phase countdown visual only
let _phaseEndsAt = 0; // performance.now() timestamp
let _keepAliveNode = null; // silent oscillator — keeps AudioContext alive on Bluetooth

export const TRANSITION_MS = 1200;

// ── Public accessors (read-only) ──────────────────────────────
export function isRunning() {
  return _isRunning;
}
export function getCycles() {
  return _cycles;
}
export function getTotalSecs() {
  return _totalSecs;
}

// ── Wake lock ─────────────────────────────────────────────────
let _wakeLock = null;

export async function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    _wakeLock = await navigator.wakeLock.request('screen');
    _wakeLock.addEventListener('release', () => {
      _wakeLock = null;
    });
  } catch (e) {
    console.warn('Wake lock failed:', e.name, e.message);
  }
}

export async function releaseWakeLock() {
  if (!_wakeLock) return;
  try {
    await _wakeLock.release();
  } catch (_) {}
  _wakeLock = null;
}

// ── Internal timing helpers ───────────────────────────────────

function _sessionTick() {
  if (!_isRunning) return;
  _totalSecs++;
  document.getElementById('session-counter').innerText = formatTime(_totalSecs);

  // Minute-based limit check (cycle-based is checked in _nextPhase)
  const { limitType, limitValue } = _getLimits();
  if (limitType === 'minutes' && checkLimit(_totalSecs, _cycles)) {
    stopTimer(i18n[lang].limitMsg(limitType, limitValue));
    return;
  }
  _sessionTimer = setTimeout(_sessionTick, 1000);
}

function _displayTick() {
  if (!_isRunning) return;
  const rem = Math.ceil((_phaseEndsAt - performance.now()) / 1000);
  document.getElementById('phase-timer').innerText = rem > 0 ? rem : '';
  _displayRAF = requestAnimationFrame(_displayTick);
}

function _waitPhase(seconds, cb) {
  clearTimeout(_phaseTimer);
  cancelAnimationFrame(_displayRAF);
  _phaseEndsAt = performance.now() + seconds * 1000;
  _phaseTimer = setTimeout(cb, seconds * 1000);
  _displayRAF = requestAnimationFrame(_displayTick);
}

// ── Cycle flow ────────────────────────────────────────────────

// Current technique timings — set by startTimer via setSessionTimes()
let _times = { inhale: 4, holdFull: 4, exhale: 4, holdEmpty: 4 };

/** Update the technique timings used by the next (or current) session start. */
export function setSessionTimes(times) {
  _times = { ...times };
}

// Tiny helper to read limit state without a circular import
let _getLimits = () => ({ limitType: 'none', limitValue: 0 });
export function registerLimitGetter(fn) {
  _getLimits = fn;
}

function _runCycle() {
  if (!_isRunning) return;

  const t = i18n[lang];
  const tIn = parseInt(_times.inhale) || 0;
  const tHF = parseInt(_times.holdFull) || 0;
  const tOut = parseInt(_times.exhale) || 0;
  const tHE = parseInt(_times.holdEmpty) || 0;

  const phases = [];
  if (tIn > 0)
    phases.push({
      dur: tIn,
      label: t.inhaling,
      state: 'active',
      transition: `transform ${tIn}s cubic-bezier(.4,0,.2,1),opacity ${tIn}s cubic-bezier(.4,0,.2,1),box-shadow ${tIn}s cubic-bezier(.4,0,.2,1)`,
    });
  if (tHF > 0)
    phases.push({ dur: tHF, label: t.holding, state: null, transition: null });
  if (tOut > 0)
    phases.push({
      dur: tOut,
      label: t.exhaling,
      state: 'collapsed',
      transition: `transform ${tOut}s cubic-bezier(.4,0,.2,1),opacity ${tOut}s cubic-bezier(.4,0,.2,1),box-shadow ${tOut}s cubic-bezier(.4,0,.2,1)`,
    });
  if (tHE > 0)
    phases.push({ dur: tHE, label: t.holding, state: null, transition: null });

  if (phases.length === 0) return;

  const breathingCircle = document.getElementById('breathing-circle');
  let idx = 0;

  function _nextPhase() {
    if (!_isRunning) return;

    if (idx >= phases.length) {
      // Cycle complete
      _cycles++;
      document.getElementById('cycle-counter').innerText = _cycles;
      updateLoop(_cycles);

      const { limitType, limitValue } = _getLimits();
      if (checkLimit(_totalSecs, _cycles)) {
        stopTimer(i18n[lang].limitMsg(limitType, limitValue));
        return;
      }
      idx = 0;
    }

    const phase = phases[idx++];
    document.getElementById('breath-text').innerText = phase.label;
    navigator.vibrate?.(40);
    if (phase.transition) breathingCircle.style.transition = phase.transition;
    if (phase.state) setCircleState(phase.state);
    _waitPhase(phase.dur, _nextPhase);
  }

  _nextPhase();
}

// ── Start / Stop ──────────────────────────────────────────────
export async function startTimer() {
  await acquireWakeLock();
  resumeAudio();
  playStartSound();

  const breathText = document.getElementById('breath-text');
  const phaseTimerEl = document.getElementById('phase-timer');
  const breathingCircle = document.getElementById('breathing-circle');
  const container = document.querySelector('.container');

  breathText.innerText = '';
  phaseTimerEl.innerText = '';
  breathingCircle.style.transition = '';
  setCircleState('collapsed');
  container.classList.add('session');
  setTimeout(() => container.classList.add('session-hide-last'), TRANSITION_MS);

  setTimeout(() => {
    _isRunning = true;
    _totalSecs = 0;
    _cycles = 0;
    document.getElementById('session-counter').innerText = '00:00';
    document.getElementById('cycle-counter').innerText = '0';

    _sessionTimer = setTimeout(_sessionTick, 1000);

    // Silent oscillator — keeps AudioContext alive during silent gaps
    // (prevents Bluetooth audio dropout on mobile)
    _keepAliveNode = audioCtx.createOscillator();
    const _kaGain = audioCtx.createGain();
    _kaGain.gain.value = 0;
    _keepAliveNode.connect(_kaGain);
    _kaGain.connect(audioCtx.destination);
    _keepAliveNode.start();

    updateLoop(_cycles);
    _runCycle();
  }, TRANSITION_MS);
}

export async function stopTimer(limitMsg) {
  _isRunning = false;
  await releaseWakeLock();

  clearTimeout(_sessionTimer);
  clearTimeout(_phaseTimer);
  cancelAnimationFrame(_displayRAF);
  _sessionTimer = _phaseTimer = _displayRAF = null;

  if (_keepAliveNode) {
    try {
      _keepAliveNode.stop();
    } catch (_) {}
    _keepAliveNode = null;
  }

  stopLoop();

  const breathText = document.getElementById('breath-text');
  const phaseTimerEl = document.getElementById('phase-timer');
  const breathingCircle = document.getElementById('breathing-circle');
  const container = document.querySelector('.container');
  const lastSession = document.getElementById('last-session');

  lastSession.innerText = `${formatTime(_totalSecs)} (${_cycles})`;
  playStopTone();
  if (limitMsg) showToast(limitMsg);

  phaseTimerEl.innerText = '';
  breathText.innerText = '';
  breathingCircle.style.transition = '';
  setCircleState('idle');
  container.classList.remove('session-hide-last');
  container.classList.remove('session');

  setTimeout(() => {
    breathText.innerText = i18n[lang].ready;
  }, TRANSITION_MS);
}
