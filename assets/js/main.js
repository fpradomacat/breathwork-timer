// ── main.js ───────────────────────────────────────────────────
//
// Entry point. Imports all modules and wires them together.
// This is the only file that knows about every module — everything
// else only imports what it needs.

import { PRESETS } from './presets.js';
import { i18n } from './i18n.js';
import { ambient, playSelectChime } from './audio.js';
import { loadTechniqueLoops } from './loop.js';
import {
  lang,
  applyLang,
  presetText,
  setTechniqueLabel,
  applyLimit,
  limitType,
  limitValue,
  openModal,
  closeModal,
  initModalListeners,
  renderPresets,
  showToast,
} from './ui.js';
import {
  isRunning,
  isTransitioning,
  startTimer,
  stopTimer,
  setSessionTimes,
  registerLimitGetter,
  acquireWakeLock,
  onSession,
  TRANSITION_MS,
} from './session.js';
import { initPractice, handleSessionEnd, refreshPracticeLang } from './practice.js';
import {
  primeMediaSession,
  showMediaSession,
  endMediaSession,
} from './media-session.js';
import { initInteractions } from './interactions.js';
import { initSoundControls } from './sound-controls.js';
import { load, save } from './storage.js';

// ── Active technique ──────────────────────────────────────────
let activePreset = PRESETS[0];

function _timesOf(preset) {
  const [inhale, holdFull, exhale, holdEmpty] = preset.timing;
  return { inhale, holdFull, exhale, holdEmpty };
}

// Give session.js a way to read limit state without circular imports
registerLimitGetter(() => ({ limitType, limitValue }));

// ── Session duration ──────────────────────────────────────────
// Chosen with the duration pill (0 = no limit). A technique with its own
// cycle limit (Fire Breath) overrides it.
const DURATIONS = [0, 3, 5, 10, 15];
let durationMin = load('duration', 0);
if (!DURATIONS.includes(durationMin)) durationMin = 0;

function applySessionLimit() {
  if (activePreset.autoLimitCycles)
    applyLimit('cycles', activePreset.autoLimitCycles);
  else if (durationMin) applyLimit('minutes', durationMin);
  else applyLimit('none', 0);
}

// ── Language ──────────────────────────────────────────────────
/** Switch the whole app (UI, technique label, voice layer) to a language. */
function setLanguage(l) {
  applyLang(l);
  refreshPracticeLang();
  if (!isRunning())
    document.getElementById('breath-text').textContent = i18n[l].ready;
  setTechniqueLabel(activePreset);
  // Voice layer switches language from the next scheduled cycle
  loadTechniqueLoops(activePreset, l);
}

// ── Bootstrap ─────────────────────────────────────────────────
window.addEventListener('load', () => {
  setSessionTimes(_timesOf(activePreset));
  setTechniqueLabel(activePreset);
  applySessionLimit();

  // Pre-load default preset audio
  loadTechniqueLoops(activePreset, lang);

  // Start ambient music on first user gesture
  ambient.bootstrap();

  // Sound on/off buttons (music, voice, breaths, ticks) + saved preferences
  initSoundControls();

  // Wire up interaction listeners
  initInteractions({
    onStartStop: () => {
      if (!isTransitioning()) isRunning() ? stopTimer() : startTimer();
    },
    onCloseModals: () =>
      document
        .querySelectorAll('.modal-overlay.open')
        .forEach((m) => closeModal(m.id)),
  });

  // Wire up modal close buttons and overlay clicks
  initModalListeners();

  // Streak, history modal, end-of-session summary
  initPractice();
});

// ── Session lifecycle ─────────────────────────────────────────
// Remember which technique the session used (the user may switch mid-session)
let sessionPreset = activePreset;
let restartingSession = false;

onSession('starting', primeMediaSession);

onSession('start', () => {
  sessionPreset = activePreset;
  showMediaSession({
    title: presetText(sessionPreset, 'name'),
    album: i18n[lang].title,
    onStop: () => stopTimer(),
  });
});

onSession('end', (result) => {
  endMediaSession();
  // Switching technique mid-session restarts it: record, but no summary
  handleSessionEnd(result, sessionPreset, restartingSession);
  restartingSession = false;
});

// Apply the initial language right away (the HTML ships in Spanish).
// Runs before tutorial.js so its first card is already in the right language.
setLanguage(lang);

// ── Circle tap → start / stop ─────────────────────────────────
document.getElementById('breathing-circle').addEventListener('click', () => {
  if (!isTransitioning()) isRunning() ? stopTimer() : startTimer();
});

// ── Técnicas pill ─────────────────────────────────────────────
document.getElementById('tecnicas-btn').addEventListener('click', () => {
  renderPresets(_onPresetSelected);
  openModal('modal-tecnicas');
});

// ── Duration pill: tap to cycle ∞ → 3 → 5 → 10 → 15 min ──────
document.getElementById('duration-btn').addEventListener('click', () => {
  if (limitType === 'cycles') {
    showToast(
      i18n[lang].durationLocked(presetText(activePreset, 'name'), limitValue),
    );
    return;
  }
  durationMin = DURATIONS[(DURATIONS.indexOf(durationMin) + 1) % DURATIONS.length];
  save('duration', durationMin);
  applySessionLimit();
});

// ── Sound panel ───────────────────────────────────────────────
document.getElementById('mixer-btn').addEventListener('click', (e) => {
  e.currentTarget.blur();
  openModal('modal-sound');
});

// ── Corner buttons: language toggle + tutorial ────────────────
document.getElementById('lang-btn').addEventListener('click', (e) => {
  setLanguage(lang === 'es' ? 'en' : 'es');
  e.currentTarget.blur();
});

document.getElementById('help-btn').addEventListener('click', (e) => {
  e.currentTarget.blur();
  window.showTutorial?.();
});

// ── Preset selection ──────────────────────────────────────────
function _onPresetSelected(preset) {
  activePreset = preset;
  setSessionTimes(_timesOf(preset));
  setTechniqueLabel(preset);
  loadTechniqueLoops(preset, lang);

  applySessionLimit();
  if (preset.autoLimitCycles) {
    setTimeout(
      () =>
        showToast(
          `${presetText(preset, 'name')} — ${i18n[lang].fireBreathAutoLimit(preset.autoLimitCycles)}`,
        ),
      300,
    );
  }

  playSelectChime();
  closeModal('modal-tecnicas');

  // Restart session with new technique if one is active
  if (isRunning()) {
    restartingSession = true;
    stopTimer();
    setTimeout(() => startTimer(), TRANSITION_MS + 100);
  }
}

// ── Visibility change ─────────────────────────────────────────
// When the user switches tabs or minimizes the browser:
//   - No active session → stop ambient music
//   - Active session    → re-acquire wake lock (released automatically on hide)
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'hidden') {
    // Don't touch music during an active session — the user chose to breathe.
    if (!isRunning()) ambient.suspend();
  } else if (document.visibilityState === 'visible') {
    if (!isRunning()) ambient.resume();
    else await acquireWakeLock();
  }
});

// ── Expose setLanguage for tutorial.js ────────────────────────
// tutorial.js is a separate (non-bundled) script that switches the
// language from its first step.
window.applyLang = setLanguage;
