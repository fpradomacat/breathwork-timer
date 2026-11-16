// ── Audio ──────────────────────────────────────────────────────
//
// Two separate concerns live here:
//
//   1. audioCtx  — shared Web Audio context used by UI sounds and
//                  technique loops. Exported so other modules can
//                  create nodes on the same context.
//
//   2. ambient   — background music player with fade in/out and
//                  mute toggle. Exported so session.js and
//                  visibilitychange handlers can stop it cleanly.

// ── Shared AudioContext ───────────────────────────────────────
export const audioCtx = new (
  window.AudioContext || window.webkitAudioContext
)();

export function resumeAudio() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

// Resume on any user gesture (needed on mobile/Safari)
document.addEventListener('mousedown', resumeAudio);
document.addEventListener('touchstart', resumeAudio, { passive: true });
document.addEventListener('keydown', resumeAudio);

// ── UI Sounds ─────────────────────────────────────────────────

/** Generic sine tone — used internally by other sound functions. */
export function playTone(freq, duration, volume) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = 'sine';
  osc.frequency.value = freq;
  const t = audioCtx.currentTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.02);
  gain.gain.linearRampToValueAtTime(0, t + duration);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

/** Short high-pass noise click — hover / interaction feedback. */
export function playHoverClick() {
  const len = Math.floor(audioCtx.sampleRate * 0.012);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++)
    data[i] =
      (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.002));

  const src = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  const hpf = audioCtx.createBiquadFilter();

  gain.gain.value = 0.2; // volumen del click

  hpf.type = 'highpass';
  hpf.frequency.value = 2400;
  src.buffer = buf;
  src.connect(hpf);
  hpf.connect(gain);
  gain.connect(audioCtx.destination);
  src.start();
}

/** Two-note chime played when a session starts. */
export function playStartSound() {
  const vol = 0.55;
  [
    [440, 0],
    [554, 0.1],
  ].forEach(([freq, delay]) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = audioCtx.currentTime + delay;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol * 0.28, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}

/** Descending tone played when a session stops. */
export function playStopTone() {
  const vol = 0.55;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(140, audioCtx.currentTime + 0.18);
  gain.gain.setValueAtTime(vol * 0.35, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.22);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.25);
}

/** Three-note ascending chime — played when a technique is selected. */
export function playSelectChime() {
  const vol = 0.55;
  [
    [520, 0],
    [660, 0.07],
    [800, 0.14],
  ].forEach(([freq, delay]) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = audioCtx.currentTime + delay;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}

// ── Ambient music ─────────────────────────────────────────────
//
// Uses its own AudioContext (separate from the main one) so it
// can be suspended/stopped independently without touching UI sounds
// or the technique loop.
//
// Public API:
//   ambient.bootstrap()     — attach first-gesture listener to init
//   ambient.setMuted(bool)  — mute / unmute with fade (safe before init)
//   ambient.suspend()       — pause on tab hide (unless muted)
//   ambient.resume()        — resume on tab show (unless muted)
//   ambient.isMuted()       — current mute state

const AMBIENT_VOLUME = 0.15;
const AMBIENT_FADE = 1; // seconds

const _amb = {
  ctx: null,
  source: null,
  gainNode: null,
  buffer: null,
  muted: false,
  loaded: false,
  suspendTimer: null,
};

function _ambFadeTo(target) {
  const g = _amb.gainNode.gain;
  g.cancelScheduledValues(_amb.ctx.currentTime);
  g.setValueAtTime(g.value, _amb.ctx.currentTime);
  g.linearRampToValueAtTime(target, _amb.ctx.currentTime + AMBIENT_FADE);
}

function _ambPlay() {
  if (!_amb.loaded || !_amb.buffer) return;
  _amb.source = _amb.ctx.createBufferSource();
  _amb.source.buffer = _amb.buffer;
  _amb.source.loop = true;
  _amb.source.connect(_amb.gainNode);
  _amb.source.start(0);
  // Muted from a saved preference → don't keep a silent context running
  if (_amb.muted) _amb.ctx.suspend();
  else _ambFadeTo(AMBIENT_VOLUME);
}

async function _ambInit() {
  // AudioContext MUST be created synchronously inside the user gesture.
  // Any await before new AudioContext() loses the gesture context on mobile.
  _amb.ctx = new AudioContext();
  _amb.gainNode = _amb.ctx.createGain();
  _amb.gainNode.gain.value = 0;
  _amb.gainNode.connect(_amb.ctx.destination);

  const res = await fetch('/assets/sounds/background-music.mp3');
  const arr = await res.arrayBuffer();
  _amb.buffer = await _amb.ctx.decodeAudioData(arr);
  _amb.loaded = true;

  _ambPlay();
}

export const ambient = {
  /** Wire up the first-gesture listener that starts ambient music. */
  bootstrap() {
    const events = ['click', 'touchend', 'keydown'];
    const handler = () => {
      _ambInit();
      events.forEach((ev) => document.removeEventListener(ev, handler));
    };
    events.forEach((ev) =>
      document.addEventListener(ev, handler, { once: true, passive: true }),
    );
  },

  /**
   * Mute / unmute with a fade. Safe to call before the music has
   * started — the state is then applied when it starts.
   */
  setMuted(muted) {
    _amb.muted = muted;
    clearTimeout(_amb.suspendTimer);
    if (!_amb.ctx || !_amb.loaded) return;
    // If the context was suspended (muted, or tab was in background),
    // resume it first so the fade actually executes.
    if (_amb.ctx.state === 'suspended') _amb.ctx.resume();
    _ambFadeTo(muted ? 0 : AMBIENT_VOLUME);
    // Suspend after the fade-out to save battery (unless unmuted meanwhile)
    if (muted)
      _amb.suspendTimer = setTimeout(() => {
        if (_amb.muted) _amb.ctx.suspend();
      }, AMBIENT_FADE * 1000);
  },

  /**
   * Suspend playback when the tab goes to the background.
   * Skip if already muted — nothing is playing, no need to suspend.
   */
  suspend() {
    if (!_amb.ctx || _amb.ctx.state !== 'running' || _amb.muted) return;
    _amb.ctx.suspend();
  },

  /**
   * Resume playback when the tab comes back to the foreground.
   * No-op if the user had manually muted before leaving.
   */
  resume() {
    if (!_amb.ctx || _amb.ctx.state !== 'suspended' || _amb.muted) return;
    _amb.ctx.resume();
  },

  isMuted() {
    return _amb.muted;
  },
};