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
//   Master clock = audioCtx.currentTime (the same clock the technique
//   audio is scheduled on in loop.js), so the voice, the circle and the
//   counters can never drift apart.
//
//   Every event has an ABSOLUTE deadline derived from the session start
//   time _t0 (phase ends at _t0 + Σ durations, session tick N at _t0 + N).
//   setTimeout is only used to wake up near each deadline — its jitter
//   never accumulates. setTimeout keeps firing when the tab is in the
//   background or the screen is off — unlike requestAnimationFrame,
//   which is paused by every mobile browser.
//
//   rAF is used only for the phase countdown number inside the circle
//   (purely cosmetic). If it pauses, the number just stops updating;
//   the phase still ends at the right time because the phase timer fires.

import { i18n } from './i18n.js';
import {
  audioCtx,
  resumeAudio,
  playStartSound,
  playStopTone,
} from './audio.js';
import { startLoop, updateLoop, stopLoop } from './loop.js';
import {
  lang,
  checkLimit,
  formatTime,
  setCircleState,
  showToast,
} from './ui.js';

// ── Session state (module-private) ───────────────────────────
let _isRunning = false;
let _isTransitioning = false; // true during the CSS transition window (start or stop)
let _cycles = 0;
let _totalSecs = 0;
let _sessionTimer = null; // setTimeout — ticks every 1 s
let _phaseTimer = null; // setTimeout — fires when a phase ends
let _displayRAF = null; // rAF — phase countdown visual only
let _t0 = 0; // audioCtx time at which the session (cycle 0) starts
let _phaseEndsAt = 0; // audioCtx time at which the current phase ends
let _keepAliveNode = null; // silent oscillator — keeps AudioContext alive on Bluetooth

export const TRANSITION_MS = 1200;

// Small lead so the first audio cycle can be scheduled in the future
const START_LEAD = 0.1; // seconds

// ── Public accessors (read-only) ──────────────────────────────
export function isRunning() {
  return _isRunning;
}
export function isTransitioning() {
  return _isTransitioning;
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

/**
 * Call `cb` once audioCtx.currentTime reaches `time`.
 * Re-checks on wake-up, so it never fires early, and if the context is
 * suspended (clock frozen) it simply waits along with the audio.
 * `setHandle` stores the latest timeout id so it can be cleared.
 */
function _at(time, cb, setHandle) {
  const check = () => {
    const wait = time - audioCtx.currentTime;
    if (wait > 0.002) setHandle(setTimeout(check, Math.max(wait * 1000, 15)));
    else cb();
  };
  check();
}

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
  _at(_t0 + _totalSecs + 1, _sessionTick, (h) => (_sessionTimer = h));
}

function _displayTick() {
  if (!_isRunning) return;
  const rem = Math.ceil(_phaseEndsAt - audioCtx.currentTime);
  document.getElementById('phase-timer').innerText = rem > 0 ? rem : '';
  _displayRAF = requestAnimationFrame(_displayTick);
}

/** Advance the phase deadline by `seconds` and call `cb` when it is reached. */
function _waitPhase(seconds, cb) {
  clearTimeout(_phaseTimer);
  cancelAnimationFrame(_displayRAF);
  _phaseEndsAt += seconds;
  _displayRAF = requestAnimationFrame(_displayTick);
  _at(_phaseEndsAt, cb, (h) => (_phaseTimer = h));
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

  // Start the technique audio on the same clock, then begin cycle 0
  // exactly at _t0 so the first phase lines up with the first audio cycle.
  _phaseEndsAt = _t0;
  startLoop(
    _t0,
    phases.reduce((sum, p) => sum + p.dur, 0),
  );
  _at(_t0, _nextPhase, (h) => (_phaseTimer = h));
}

// ── Start / Stop ──────────────────────────────────────────────
export async function startTimer() {
  if (_isRunning || _isTransitioning) return;
  _isTransitioning = true;
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
    _isTransitioning = false;
    _totalSecs = 0;
    _cycles = 0;
    document.getElementById('session-counter').innerText = '00:00';
    document.getElementById('cycle-counter').innerText = '0';

    // Anchor the whole session to the audio clock
    _t0 = audioCtx.currentTime + START_LEAD;
    _at(_t0 + 1, _sessionTick, (h) => (_sessionTimer = h));

    // Silent oscillator — keeps AudioContext alive during silent gaps
    // (prevents Bluetooth audio dropout on mobile)
    _keepAliveNode = audioCtx.createOscillator();
    const _kaGain = audioCtx.createGain();
    _kaGain.gain.value = 0;
    _keepAliveNode.connect(_kaGain);
    _kaGain.connect(audioCtx.destination);
    _keepAliveNode.start();

    _runCycle();
  }, TRANSITION_MS);
}

export async function stopTimer(limitMsg) {
  if (!_isRunning || _isTransitioning) return;
  _isRunning = false;
  _isTransitioning = true;
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
    _isTransitioning = false;
  }, TRANSITION_MS);
}
