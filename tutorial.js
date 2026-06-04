// ── i18n ──────────────────────────────────────────────────────
const i18n = {
  es: {
    title: 'Neyen | el arte de respirar',
    statSession: 'Sesión',
    statCycles: 'Ciclos',
    statLast: 'Última',
    inhale: 'Inhala',
    holdFull: 'Pausa (Lleno)',
    exhale: 'Exhala',
    holdEmpty: 'Pausa (Vacío)',
    vol: 'Vol',
    start: 'Iniciar',
    stop: 'Detener',
    reset: 'Reset',
    ready: 'Listo',
    inhaling: 'Inhala',
    holding: 'Mantén',
    exhaling: 'Exhala',
    waiting: 'Espera',
    menuPresets: 'Técnicas',
    menuSounds: '🔔 Sonidos',
    presetApply: 'Aplicar',
    limitTitle: 'Límite de sesión',
    limitNone: 'Sin límite',
    limitMin: 'Minutos',
    limitCyc: 'Ciclos',
    soundPhases: ['Inhalar', 'Pausa (Lleno)', 'Exhalar', 'Pausa (Vacío)'],
    limitMsg: (type, val) =>
      type === 'minutes'
        ? `⏱ ${val} min alcanzados`
        : `🔄 ${val} ciclos completados`,
    limitBadgeMin: (val) => `⏱ ${val} min`,
    limitBadgeCyc: (val) => `🔄 ${val} ciclos`,
    custom: 'Personalizado',
    sectionTheme: 'Tema',
    settingsTitle: 'Configuración',
    settingsLabel: 'Ajustes',
    sectionTiming: 'Tiempos',
    donate: '😊 Dona',
    fireBreathAutoLimit: (n) => `límite automático: ${n} ciclos`,
  },
  en: {
    title: 'Neyen | the art of breathing',
    statSession: 'Session',
    statCycles: 'Cycles',
    statLast: 'Last',
    inhale: 'Inhale',
    holdFull: 'Hold (Full)',
    exhale: 'Exhale',
    holdEmpty: 'Hold (Empty)',
    vol: 'Vol',
    start: 'Start',
    stop: 'Stop',
    reset: 'Reset',
    ready: 'Ready',
    inhaling: 'Inhale',
    holding: 'Hold',
    exhaling: 'Exhale',
    waiting: 'Wait',
    menuPresets: 'Techniques',
    menuSounds: '🔔 Sounds',
    presetApply: 'Apply',
    limitTitle: 'Session limit',
    limitNone: 'No limit',
    limitMin: 'Minutes',
    limitCyc: 'Cycles',
    soundPhases: ['Inhale', 'Hold (Full)', 'Exhale', 'Hold (Empty)'],
    limitMsg: (type, val) =>
      type === 'minutes'
        ? `⏱ ${val} min reached`
        : `🔄 ${val} cycles completed`,
    limitBadgeMin: (val) => `⏱ ${val} min`,
    limitBadgeCyc: (val) => `🔄 ${val} cycles`,
    custom: 'Custom',
    sectionTheme: 'Theme',
    settingsTitle: 'Settings',
    settingsLabel: 'Settings',
    sectionTiming: 'Timings',
    donate: '😊 Donate',
    fireBreathAutoLimit: (n) => `auto-limit: ${n} cycles`,
  },
};

let lang = 'es';

// ── DOM refs ──────────────────────────────────────────────────
const vol = 1;
const DEFAULT_TIMES = {
  inhale: 4,
  holdFull: 4,
  exhale: 4,
  holdEmpty: 4,
};

const times = {
  inhale: 4,
  holdFull: 4,
  exhale: 4,
  holdEmpty: 4,
};
const breathText = document.getElementById('breath-text');
const phaseTimerDisplay = document.getElementById('phase-timer');
const breathingCircle = document.getElementById('breathing-circle');
const startBtn = document.getElementById('start-btn');
const techniquesBtn = document.getElementById('techniques-btn');
const sessionCounter = document.getElementById('session-counter');
const cycleCounter = document.getElementById('cycle-counter');
const lastSession = document.getElementById('last-session');
const techniqueLabel = document.getElementById('technique-label');

// ── Audio context ─────────────────────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function resumeAudio() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
document.addEventListener('mousedown', resumeAudio);
document.addEventListener('touchstart', resumeAudio, { passive: true });
document.addEventListener('keydown', resumeAudio);

// ── Technique label ───────────────────────────────────────────
let activeTechniqueName = 'Box Breathing';

function setTechniqueLabel(name, isCustom = false) {
  if (!isCustom) activeTechniqueName = name;
  techniqueLabel.textContent = isCustom ? i18n[lang].custom : name;
  techniqueLabel.classList.toggle('is-custom', isCustom);
}

// ── UI sounds (all synthetic, Web Audio API) ──────────────────
function playTone(freq, duration, vol) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = 'sine';
  osc.frequency.value = freq;
  const t = audioCtx.currentTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.02);
  gain.gain.linearRampToValueAtTime(0, t + duration);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

function playHoverClick() {
  const len = Math.floor(audioCtx.sampleRate * 0.012);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++)
    data[i] =
      (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.002));
  const src = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  const hpf = audioCtx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = 2400;
  src.buffer = buf;
  src.connect(hpf);
  hpf.connect(gain);
  gain.connect(audioCtx.destination);
  src.start();
}

function playStartSound() {
  if (vol <= 0) return;
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

function playStopTone() {
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

function playSelectChime() {
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

// ── Hover click ───────────────────────────────────────────────
const HOVER_SELECTOR = [
  '#start-btn',
  '#presets-btn',
  '.ctrl-option',
  '.input-group input',
  '.bmc-btn',
  '.author-tag',
  '.preset-card',
  '.modal-close',
  '.reset-inline-btn',
  '.settings-pill',
  '#breathing-circle',
  '.pill-tecnicas',
  '.pill-ajustes',
  '.theme-chip',
].join(', ');

let _lastHoverEl = null;
let _suppressHover = false;
let _lastWasTouch = false;

document.addEventListener('mouseover', (e) => {
  if (_suppressHover || _lastWasTouch) return;
  const el = e.target.closest(HOVER_SELECTOR);
  if (el && el !== _lastHoverEl) {
    playHoverClick();
    _lastHoverEl = el;
  }
});
document.addEventListener('mouseout', (e) => {
  const el = e.target.closest(HOVER_SELECTOR);
  if (el && !el.contains(e.relatedTarget)) _lastHoverEl = null;
});

// On touch: haptic only (no sound — avoids double-firing with synthetic mouseover)
document.addEventListener(
  'touchstart',
  (e) => {
    _lastWasTouch = true;
    const el = e.target.closest(HOVER_SELECTOR);
    if (el && !el.disabled) {
      if (navigator.vibrate) navigator.vibrate(8);
    }
  },
  { passive: true },
);

// Reset touch flag on real mouse movement (desktop)
document.addEventListener(
  'mousemove',
  () => {
    _lastWasTouch = false;
  },
  { passive: true },
);

// ── i18n ─────────────────────────────────────────────────────
function applyLang(l) {
  lang = l;
  const t = i18n[l];
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (t[key] && typeof t[key] === 'string') el.textContent = t[key];
  });
  document.getElementById('lang-btn').textContent = l.toUpperCase();
  document
    .querySelectorAll('#lang-dropdown .ctrl-option')
    .forEach((o) => o.classList.toggle('active', o.dataset.value === l));
  if (!isRunning) breathText.textContent = t.ready;
  // Re-translate the active technique name if it matches a preset
  const isCustom = techniqueLabel.classList.contains('is-custom');
  if (!isCustom && activeTechniqueName) {
    const preset = PRESETS.find(
      (p) =>
        p.nameEs === activeTechniqueName || p.nameEn === activeTechniqueName,
    );
    if (preset) {
      activeTechniqueName = l === 'es' ? preset.nameEs : preset.nameEn;
      techniqueLabel.textContent = activeTechniqueName;
    } else {
      setTechniqueLabel(activeTechniqueName, false);
    }
  } else if (isCustom) {
    techniqueLabel.textContent = t.custom;
  }
  // Re-render presets so descriptions update in the open modal
  if (document.getElementById('presets-list')) renderPresets();
  document.title = t.title;
  updateLimitBadge();
}

// ── Dropdowns ────────────────────────────────────────────────
const allDropdowns = [
  'lang-dropdown',
];

function toggleDropdown(id) {
  const isOpen = document.getElementById(id).classList.contains('open');
  allDropdowns.forEach((d) =>
    document.getElementById(d).classList.remove('open'),
  );
  if (!isOpen) document.getElementById(id).classList.add('open');
}

document.addEventListener('click', () =>
  allDropdowns.forEach((d) =>
    document.getElementById(d).classList.remove('open'),
  ),
);

document.getElementById('lang-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleDropdown('lang-dropdown');
});
document.querySelectorAll('#lang-dropdown .ctrl-option').forEach((o) =>
  o.addEventListener('click', () => {
    applyLang(o.dataset.value);
    document.getElementById('lang-dropdown').classList.remove('open');
  }),
);

// ── Session limit ─────────────────────────────────────────────
let limitType = 'none';
let limitValue = 10;


function checkLimit() {
  if (limitType === 'none') return false;
  if (limitType === 'minutes' && totalSeconds >= limitValue * 60) return true;
  if (limitType === 'cycles' && cycles >= limitValue) return true;
  return false;
}

// Apply a limit programmatically (used by Fire Breath auto-limit)
function applyLimit(type, value) {
  limitType = type;
  limitValue = value;
  updateLimitBadge();
}

// Show/hide the limit badge in the meta-row
function updateLimitBadge() {
  const badge = document.getElementById('limit-badge');
  if (!badge) return;
  if (limitType === 'none') {
    badge.textContent = '';
    badge.style.display = 'none';
  } else {
    const t = i18n[lang];
    badge.textContent =
      limitType === 'minutes'
        ? t.limitBadgeMin(limitValue)
        : t.limitBadgeCyc(limitValue);
    badge.style.display = 'inline-flex';
  }
}

// ── Presets ───────────────────────────────────────────────────
const PRESETS = [
  {
    nameEs: 'Respiración cuadrada',
    nameEn: 'Box Breathing',
    timing: [4, 4, 4, 4],
    descEs:
      'Inhala, retén, exhala, retén — 4 segundos cada paso. Calma la mente rápido.',
    descEn:
      'Inhale, hold, exhale, hold — 4 seconds each. Quickly calms the mind.',
  },
  {
    nameEs: 'Coherencia Cardíaca',
    nameEn: 'Cardiac Coherence',
    timing: [5, 0, 5, 0],
    descEs:
      '5 segundos adentro, 5 afuera. Sincroniza el corazón y la mente. Ideal para el día a día.',
    descEn:
      '5 seconds in, 5 out. Syncs heart and mind. Great for daily practice.',
  },
  {
    nameEs: '4-7-8 Relajante',
    nameEn: '4-7-8 Relaxing',
    timing: [4, 7, 8, 0],
    descEs:
      'Inhala 4, retén 7, exhala 8. Reduce la ansiedad y ayuda a conciliar el sueño.',
    descEn:
      'Inhale 4, hold 7, exhale 8. Eases anxiety and helps you fall asleep.',
  },
  {
    nameEs: 'Fuego',
    nameEn: 'Fire Breath',
    timing: [1, 0, 1, 0],
    autoLimitCycles: 30,
    descEs: 'Respiración rápida y rítmica para activarte. Máximo 30 ciclos.',
    descEn: 'Fast rhythmic breathing to energize you. Max 30 cycles.',
  },
];

function renderPresets() {
  const list = document.getElementById('presets-list');
  list.innerHTML = '';
  PRESETS.forEach((p) => {
    const [i, hf, e, he] = p.timing;
    const card = document.createElement('div');
    card.className = 'preset-card';
    const hasAutoLimit = !!p.autoLimitCycles;
    card.innerHTML = `
            <div class="preset-header">
                <span class="preset-name">${lang === 'es' ? p.nameEs : p.nameEn}</span>
                <span class="preset-timing">${i}-${hf}-${e}-${he}</span>
            </div>
            <p class="preset-desc">${lang === 'es' ? p.descEs : p.descEn}</p>`;
    card.addEventListener('click', () => {
      times.inhale = i;
      times.holdFull = hf;
      times.exhale = e;
      times.holdEmpty = he;
      const name = lang === 'es' ? p.nameEs : p.nameEn;
      setTechniqueLabel(name);
      // Auto-limit for techniques that define it; reset for those that don't
      if (hasAutoLimit) {
        applyLimit('cycles', p.autoLimitCycles);
        const techName = lang === 'es' ? p.nameEs : p.nameEn;
        setTimeout(
          () =>
            showToast(
              `${techName} — ${i18n[lang].fireBreathAutoLimit(p.autoLimitCycles)}`,
            ),
          300,
        );
      } else {
        applyLimit('none', 10);
      }
      playSelectChime();
      closeModal('modal-tecnicas');
      // Si hay sesión activa, pararla y arrancar de nuevo con los nuevos tiempos
      if (isRunning) {
        stopTimer();
        setTimeout(() => startTimer(), 1300);
      }
    });
    list.appendChild(card);
  });
}

// ── Phase sounds ─────────────────────────────────────────────
// Primary path: fetch + decodeAudioData into AudioBuffers (Web Audio API).
// This bypasses the OS audio stack, eliminating Bluetooth dropouts on mobile.
// Fallback path: HTMLAudioElement, used if decode fails (e.g. file:// protocol,
// missing file, or browser decode error) so desktop always works.
const PHASE_SOUND_SRCS = [
  'assets/sounds/inhala.mp3',
  'assets/sounds/pausa_lleno.mp3',
  'assets/sounds/exhala.mp3',
  'assets/sounds/pausa_vacio.mp3',
];

const _phaseBuffers = new Array(PHASE_SOUND_SRCS.length).fill(null);
const _phaseAudioEls = PHASE_SOUND_SRCS.map((src) => {
  const a = new Audio(src);
  a.preload = 'auto';
  a.load();
  return a;
});

// Only attempt fetch/decode when served over http(s) — file:// blocks fetch with CORS errors.
if (location.protocol !== 'file:') {
  PHASE_SOUND_SRCS.forEach((src, i) => {
    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(r.status);
        return r.arrayBuffer();
      })
      .then((ab) => audioCtx.decodeAudioData(ab))
      .then((buf) => {
        _phaseBuffers[i] = buf;
      })
      .catch(() => {
        /* decode failed — fallback HTMLAudioElement will be used */
      });
  });
}

function playPhase(pi) {
  if (_phaseBuffers[pi]) {
    // Web Audio path — zero latency, no OS stack, Bluetooth-safe
    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    src.buffer = _phaseBuffers[pi];
    gain.gain.value = vol;
    src.connect(gain);
    gain.connect(audioCtx.destination);
    src.start();
  } else {
    // Fallback: HTMLAudioElement (decode not ready or failed)
    const a = _phaseAudioEls[pi];
    if (!a) return;
    a.volume = vol;
    a.currentTime = 0;
    a.play().catch(() => {});
  }
}

// ── Modals ────────────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  // Always scroll to top
  const body = el.querySelector('.modal-body');
  if (body) body.scrollTop = 0;
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}
document
  .querySelectorAll('.modal-close')
  .forEach((btn) =>
    btn.addEventListener('click', () => closeModal(btn.dataset.close)),
  );
document.querySelectorAll('.modal-overlay').forEach((el) =>
  el.addEventListener('click', (e) => {
    if (e.target === el) closeModal(el.id);
  }),
);

// ── Toast ─────────────────────────────────────────────────────
const toastEl = document.createElement('div');
toastEl.className = 'limit-toast';
document.body.appendChild(toastEl);
let _toastTimer;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3500);
}

// ── Helpers ───────────────────────────────────────────────────
function formatTime(s) {
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}
function setCircleState(state) {
  breathingCircle.classList.remove('idle', 'collapsed', 'active');
  if (state !== 'idle') breathingCircle.classList.add(state);
}

// ── Session state ─────────────────────────────────────────────
let isRunning = false;
let cycles = 0;
let totalSeconds = 0;
let _sessionTimer = null; // setTimeout handle — ticks every 1 s
let _phaseTimer = null; // setTimeout handle — fires when phase ends
let _displayRAF = null; // rAF handle — only used for phase countdown display
let _keepAliveNode = null; // silent oscillator — keeps AudioContext alive on Bluetooth

// ─────────────────────────────────────────────────────────────
// TIMING STRATEGY
//
// All critical timing (phase advances, session counter, limit checks)
// runs on plain setTimeout chains.  setTimeout keeps firing even when
// the browser tab is in the background or the screen is off — unlike
// requestAnimationFrame, which is paused by every mobile browser.
//
// rAF is used only for the phase countdown number inside the circle
// (purely cosmetic).  If it pauses, the number just stops updating;
// the phase still ends at the right time because _phaseTimer fires.
// ─────────────────────────────────────────────────────────────

// Session clock — fires every 1 000 ms, increments totalSeconds
function _sessionTick() {
  if (!isRunning) return;
  totalSeconds++;
  sessionCounter.innerText = formatTime(totalSeconds);
  if (limitType === 'minutes' && checkLimit()) {
    stopTimer(i18n[lang].limitMsg(limitType, limitValue));
    return;
  }
  _sessionTimer = setTimeout(_sessionTick, 1000);
}

// Phase countdown display — rAF loop, purely visual
// phaseEndsAt is a performance.now() timestamp
let _phaseEndsAt = 0;
function _displayTick() {
  if (!isRunning) return;
  const rem = Math.ceil((_phaseEndsAt - performance.now()) / 1000);
  phaseTimerDisplay.innerText = rem > 0 ? rem : '';
  _displayRAF = requestAnimationFrame(_displayTick);
}

// Wait `seconds` then call `cb`. Stores handle in _phaseTimer so it
// can be cancelled cleanly. Also kicks off the display loop.
function waitPhase(seconds, cb) {
  clearTimeout(_phaseTimer);
  cancelAnimationFrame(_displayRAF);
  _phaseEndsAt = performance.now() + seconds * 1000;
  _phaseTimer = setTimeout(cb, seconds * 1000);
  _displayRAF = requestAnimationFrame(_displayTick);
}

// ── Flow ──────────────────────────────────────────────────────
// Flat callback chain — no async/await, no Promises.
// Each phase calls the next one directly via waitPhase().
function runCycle() {
  if (!isRunning) return;

  const t = i18n[lang];
  const tIn = parseInt(times.inhale) || 0;
  const tHF = parseInt(times.holdFull) || 0;
  const tOut = parseInt(times.exhale) || 0;
  const tHE = parseInt(times.holdEmpty) || 0;

  // Build phase list — skip any with duration 0
  const phases = [];
  if (tIn > 0)
    phases.push({
      dur: tIn,
      label: t.inhaling,
      state: 'active',
      sound: 0,
      transition: `transform ${tIn}s cubic-bezier(.4,0,.2,1),opacity ${tIn}s cubic-bezier(.4,0,.2,1),box-shadow ${tIn}s cubic-bezier(.4,0,.2,1)`,
    });
  if (tHF > 0)
    phases.push({
      dur: tHF,
      label: t.holding,
      state: null,
      sound: 1,
      transition: null,
    });
  if (tOut > 0)
    phases.push({
      dur: tOut,
      label: t.exhaling,
      state: 'collapsed',
      sound: 2,
      transition: `transform ${tOut}s cubic-bezier(.4,0,.2,1),opacity ${tOut}s cubic-bezier(.4,0,.2,1),box-shadow ${tOut}s cubic-bezier(.4,0,.2,1)`,
    });
  if (tHE > 0)
    phases.push({
      dur: tHE,
      label: t.waiting,
      state: null,
      sound: 3,
      transition: null,
    });

  if (phases.length === 0) return;

  let idx = 0;

  function nextPhase() {
    if (!isRunning) return;

    if (idx >= phases.length) {
      // Cycle complete
      cycles++;
      cycleCounter.innerText = cycles;
      if (checkLimit()) {
        stopTimer(i18n[lang].limitMsg(limitType, limitValue));
        return;
      }
      idx = 0; // restart cycle
    }

    const phase = phases[idx++];
    breathText.innerText = phase.label;
    if (phase.transition) breathingCircle.style.transition = phase.transition;
    if (phase.state) setCircleState(phase.state);
    playPhase(phase.sound);
    waitPhase(phase.dur, nextPhase);
  }

  nextPhase();
}

// ── Start / Stop ──────────────────────────────────────────────
const TRANSITION_MS = 1200;

function startTimer() {
  resumeAudio();
  playStartSound();
  _suppressHover = true;
  breathText.innerText = '';
  phaseTimerDisplay.innerText = '';
  breathingCircle.style.transition = '';
  setCircleState('collapsed');
  const _container = document.querySelector('.container');
  _container.classList.add('session');
  // After animation completes, snap last-stat to display:none (no phantom space)
  setTimeout(
    () => _container.classList.add('session-hide-last'),
    TRANSITION_MS,
  );

  setTimeout(() => {
    isRunning = true;
    totalSeconds = 0;
    cycles = 0;
    sessionCounter.innerText = '00:00';
    cycleCounter.innerText = '0';

    // Start session clock
    _sessionTimer = setTimeout(_sessionTick, 1000);

    // Keep AudioContext alive for the whole session.
    // Without this, mobile browsers (especially with Bluetooth) suspend
    // the context during silent gaps, causing audible dropouts on resume.
    _keepAliveNode = audioCtx.createOscillator();
    const _kaGain = audioCtx.createGain();
    _kaGain.gain.value = 0; // completely silent
    _keepAliveNode.connect(_kaGain);
    _kaGain.connect(audioCtx.destination);
    _keepAliveNode.start();

    // Start breathing flow
    runCycle();

    setTimeout(() => {
      _suppressHover = false;
      _lastHoverEl = null;
    }, 100);
  }, TRANSITION_MS);
}

function stopTimer(limitMsg) {
  isRunning = false;

  // Cancel all timers
  clearTimeout(_sessionTimer);
  clearTimeout(_phaseTimer);
  cancelAnimationFrame(_displayRAF);
  _sessionTimer = null;
  _phaseTimer = null;
  _displayRAF = null;

  // Stop the keep-alive oscillator
  if (_keepAliveNode) {
    try {
      _keepAliveNode.stop();
    } catch (e) {}
    _keepAliveNode = null;
  }

  lastSession.innerText = `${formatTime(totalSeconds)} (${cycles})`;
  playStopTone();
  if (limitMsg) showToast(limitMsg);

  phaseTimerDisplay.innerText = '';
  breathText.innerText = '';
  breathingCircle.style.transition = '';
  setCircleState('idle');
  const _container = document.querySelector('.container');
  _container.classList.remove('session-hide-last'); // restore before animation
  _container.classList.remove('session');

  setTimeout(() => {
    breathText.innerText = i18n[lang].ready;
  }, TRANSITION_MS);
}

startBtn.onclick = () => (isRunning ? stopTimer() : startTimer());

// ── Click sound on all interactive elements ───────────────────
// Plays on mouse click (desktop) and touch tap (mobile, via touchend
// so it doesn't double-fire with the touchstart haptic).
const CLICK_SOUND_SELECTOR = [
  'button:not(:disabled)',
  'a',
  '.preset-card',
  '.reset-inline-btn',
  '.pill-tecnicas',
  '.pill-ajustes',
  '.theme-chip',
  '.modal-close',
  '.bmc-btn',
].join(', ');

document.addEventListener('click', (e) => {
  if (_lastWasTouch) return; // mobile: handled by touchend below
  const el = e.target.closest(CLICK_SOUND_SELECTOR);
  if (el) playHoverClick();
});

document.addEventListener(
  'touchend',
  (e) => {
    const el = e.target.closest(CLICK_SOUND_SELECTOR);
    if (el && !el.disabled) playHoverClick();
  },
  { passive: true },
);

// ── Keyboard shortcuts ────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Escape: close any open modal
  if (e.key === 'Escape') {
    document
      .querySelectorAll('.modal-overlay.open')
      .forEach((m) => closeModal(m.id));
    return;
  }
  // Space: start / stop — only when no modal is open and no input is focused
  if (e.key === ' ' || e.code === 'Space') {
    const modalOpen = document.querySelector('.modal-overlay.open');
    const focused = document.activeElement;
    const isInput =
      focused && ['INPUT', 'TEXTAREA', 'SELECT'].includes(focused.tagName);
    if (modalOpen || isInput) return;
    e.preventDefault(); // prevent page scroll
  }
});

// Prevent browser session-restore from showing stale input values
window.addEventListener('load', () => {
  times.inhale = DEFAULT_TIMES.inhale;
  times.holdFull = DEFAULT_TIMES.holdFull;
  times.exhale = DEFAULT_TIMES.exhale;
  times.holdEmpty = DEFAULT_TIMES.holdEmpty;
  setTechniqueLabel(lang === 'es' ? 'Respiración cuadrada' : 'Box Breathing');
  applyLimit('none', 10);
});
