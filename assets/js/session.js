// ── Session ───────────────────────────────────────────────────
//
// Owns all the breathing session state and timing:
//   - isRunning flag
//   - 3-2-1 countdown, then the breathing cycle phases
//   - session clock and limit checks
//   - phase countdown number (rAF — purely visual)
//   - wake lock
//   - keep-alive oscillator (prevents AudioContext suspension on Bluetooth)
//   - 'start' / 'end' events for the rest of the app (summary, history,
//     lock-screen controls…)
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
  playCountTick,
  playEndChime,
} from './audio.js';
import { startLoop, stopLoop, loopsReady } from './loop.js';
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
let _phaseTimer = null; // setTimeout — countdown steps, then phase ends
let _displayRAF = null; // rAF — phase countdown visual only
let _t0 = 0; // audioCtx time at which the breathing (cycle 0) starts
let _phaseEndsAt = 0; // audioCtx time at which the current phase ends
let _keepAliveNode = null; // silent oscillator — keeps AudioContext alive on Bluetooth

export const TRANSITION_MS = 1200;

// Small lead so the first audio cycle can be scheduled in the future
const START_LEAD = 0.1; // seconds
// "Get ready" countdown before the first inhale
const COUNTDOWN = 3; // seconds
// Audio fade-out when a session stops
const STOP_FADE = 1.5; // seconds

// ── Public accessors (read-only) ──────────────────────────────
export function isRunning() {
  return _isRunning;
}
export function isTransitioning() {
  return _isTransitioning;
}

// ── Events ────────────────────────────────────────────────────
//   'starting' → ()  — synchronously inside the user's tap (before any await)
//   'start'    → ()  — the session is running (countdown begins)
//   'end'      → ({ secs, cycles, limitReached, limitMsg })
const _listeners = { starting: [], start: [], end: [] };
export function onSession(event, fn) {
  _listeners[event].push(fn);
}
function _emit(event, data) {
  _listeners[event].forEach((fn) => {
    try {
      fn(data);
    } catch (e) {
      console.error(e);
    }
  });
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

// Current technique timings — set via setSessionTimes()
let _times = { inhale: 4, holdFull: 4, exhale: 4, holdEmpty: 4 };

/** Update the technique timings used by the next session start. */
export function setSessionTimes(times) {
  _times = { ...times };
}

// Tiny helper to read limit state without a circular import
let _getLimits = () => ({ limitType: 'none', limitValue: 0 });
export function registerLimitGetter(fn) {
  _getLimits = fn;
}

/** Build the phase list for the current timings (zero-length phases are skipped). */
function _buildPhases() {
  const t = i18n[lang];
  // Seconds may be fractional (e.g. 5.5 s resonance breathing)
  const tIn = parseFloat(_times.inhale) || 0;
  const tHF = parseFloat(_times.holdFull) || 0;
  const tOut = parseFloat(_times.exhale) || 0;
  const tHE = parseFloat(_times.holdEmpty) || 0;
  const ease = 'cubic-bezier(.4,0,.2,1)';
  const move = (s) =>
    `transform ${s}s ${ease},opacity ${s}s ${ease},box-shadow ${s}s ${ease},background-color ${s}s ${ease},border-color ${s}s ${ease}`;

  const phases = [];
  if (tIn > 0)
    phases.push({
      dur: tIn,
      label: t.inhaling,
      state: 'active',
      transition: move(tIn),
    });
  if (tHF > 0)
    phases.push({
      dur: tHF,
      label: t.holdingFull,
      state: null,
      transition: null,
    });
  if (tOut > 0)
    phases.push({
      dur: tOut,
      label: t.exhaling,
      state: 'collapsed',
      transition: move(tOut),
    });
  if (tHE > 0)
    phases.push({
      dur: tHE,
      label: t.holdingEmpty,
      state: null,
      transition: null,
    });
  return phases;
}

function _runCycle() {
  if (!_isRunning) return;

  const phases = _buildPhases();
  if (phases.length === 0) return;

  const breathText = document.getElementById('breath-text');
  const phaseTimerEl = document.getElementById('phase-timer');
  const breathingCircle = document.getElementById('breathing-circle');
  let idx = 0;

  function _nextPhase() {
    if (!_isRunning) return;

    if (idx >= phases.length) {
      // Cycle complete
      _cycles++;
      document.getElementById('cycle-counter').innerText = _cycles;

      const { limitType, limitValue } = _getLimits();
      if (limitType === 'cycles' && checkLimit(_totalSecs, _cycles)) {
        stopTimer(i18n[lang].limitMsg(limitType, limitValue));
        return;
      }
      idx = 0;
    }

    const phase = phases[idx++];
    breathText.innerText = phase.label;
    // The new phase word fades in instead of snapping
    // (from 0 up to whatever opacity the stylesheet gives it)
    breathText.animate?.([{ opacity: 0, offset: 0 }], {
      duration: 500,
      easing: 'ease-out',
    });
    navigator.vibrate?.(40);
    if (phase.transition) {
      breathingCircle.style.transition = phase.transition;
      // For layers the inline transition can't reach (theme-light.css)
      breathingCircle.style.setProperty('--phase-dur', `${phase.dur}s`);
    }
    if (phase.state) setCircleState(phase.state);
    _waitPhase(phase.dur, _nextPhase);
  }

  // 3-2-1 countdown, then cycle 0 starts exactly at _t0 — the same moment
  // the first audio cycle is scheduled for.
  function _countdown(n) {
    if (!_isRunning) return;
    if (n === 0) {
      _nextPhase();
      return;
    }
    phaseTimerEl.innerText = n;
    playCountTick(n === 1);
    navigator.vibrate?.(15);
    _at(
      _t0 - (n - 1),
      () => _countdown(n - 1),
      (h) => (_phaseTimer = h),
    );
  }

  _phaseEndsAt = _t0;
  startLoop(
    _t0,
    phases.reduce((sum, p) => sum + p.dur, 0),
  );
  breathText.innerText = i18n[lang].getReady;
  _at(
    _t0 - COUNTDOWN,
    () => _countdown(COUNTDOWN),
    (h) => (_phaseTimer = h),
  );
}

// ── Start / Stop ──────────────────────────────────────────────
export async function startTimer() {
  if (_isRunning || _isTransitioning) return;
  _isTransitioning = true;
  _emit('starting');
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
  breathingCircle.style.removeProperty('--phase-dur');
  setCircleState('collapsed');
  container.classList.add('session');
  setTimeout(() => container.classList.add('session-hide-last'), TRANSITION_MS);

  setTimeout(async () => {
    // Make sure the technique audio is decoded before anchoring the clock
    // (usually already done; capped by a timeout inside loopsReady)
    await loopsReady();

    _isRunning = true;
    _isTransitioning = false;
    _totalSecs = 0;
    _cycles = 0;
    document.getElementById('session-counter').innerText = '00:00';
    document.getElementById('cycle-counter').innerText = '0';

    // Anchor the whole session to the audio clock (after the countdown)
    _t0 = audioCtx.currentTime + START_LEAD + COUNTDOWN;
    _at(_t0 + 1, _sessionTick, (h) => (_sessionTimer = h));

    // Silent oscillator — keeps AudioContext alive during silent gaps
    // (prevents Bluetooth audio dropout on mobile)
    _keepAliveNode = audioCtx.createOscillator();
    const _kaGain = audioCtx.createGain();
    _kaGain.gain.value = 0;
    _keepAliveNode.connect(_kaGain);
    _kaGain.connect(audioCtx.destination);
    _keepAliveNode.start();

    _emit('start');
    _runCycle();
  }, TRANSITION_MS);
}

/**
 * Stop the session.
 * @param {string} [limitMsg] — set when the session ended by reaching its limit
 */
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

  // Let the breathing audio fade out instead of cutting it
  stopLoop(STOP_FADE);
  if (limitMsg) playEndChime();
  else playStopTone();

  const breathText = document.getElementById('breath-text');
  const phaseTimerEl = document.getElementById('phase-timer');
  const breathingCircle = document.getElementById('breathing-circle');
  const container = document.querySelector('.container');

  phaseTimerEl.innerText = '';
  breathText.innerText = '';
  breathingCircle.style.transition = '';
  breathingCircle.style.removeProperty('--phase-dur');
  setCircleState('idle');
  container.classList.remove('session-hide-last');
  container.classList.remove('session');

  const result = {
    secs: _totalSecs,
    cycles: _cycles,
    limitReached: Boolean(limitMsg),
    limitMsg,
  };

  setTimeout(() => {
    breathText.innerText = i18n[lang].ready;
    _isTransitioning = false;
    // Listeners (summary, history…) run once the stop animation is done.
    // If nobody shows a summary for a short session, the toast still informs.
    _emit('end', result);
  }, TRANSITION_MS);

  if (limitMsg && _totalSecs < 30) showToast(limitMsg);
}
