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
  TRANSITION_MS,
} from './session.js';
import { initInteractions } from './interactions.js';
import { initSoundControls } from './sound-controls.js';

// ── Active technique ──────────────────────────────────────────
let activePreset = PRESETS[0];

function _timesOf(preset) {
  const [inhale, holdFull, exhale, holdEmpty] = preset.timing;
  return { inhale, holdFull, exhale, holdEmpty };
}

// Give session.js a way to read limit state without circular imports
registerLimitGetter(() => ({ limitType, limitValue }));

// ── Language ──────────────────────────────────────────────────
/** Switch the whole app (UI, technique label, voice layer) to a language. */
function setLanguage(l) {
  applyLang(l);
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
  applyLimit('none', 10);

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

  // Language options
  document.querySelectorAll('#lang-dropdown .ctrl-option').forEach((opt) => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      setLanguage(opt.dataset.value);
    });
  });
});

// ── Circle tap → start / stop ─────────────────────────────────
document.getElementById('breathing-circle').addEventListener('click', () => {
  if (!isTransitioning()) isRunning() ? stopTimer() : startTimer();
});

// ── Técnicas pill ─────────────────────────────────────────────
document.getElementById('tecnicas-btn').addEventListener('click', () => {
  renderPresets(_onPresetSelected);
  openModal('modal-tecnicas');
});

// ── Lang button / dropdown ────────────────────────────────────
const langBtn = document.getElementById('lang-btn');
const langDropdown = document.getElementById('lang-dropdown');

langBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = langDropdown.classList.contains('open');
  langDropdown.classList.toggle('open', !isOpen);
});

document.addEventListener('click', () =>
  langDropdown?.classList.remove('open'),
);

// ── Preset selection ──────────────────────────────────────────
function _onPresetSelected(preset) {
  activePreset = preset;
  setSessionTimes(_timesOf(preset));
  setTechniqueLabel(preset);
  loadTechniqueLoops(preset, lang);

  if (preset.autoLimitCycles) {
    applyLimit('cycles', preset.autoLimitCycles);
    setTimeout(
      () =>
        showToast(
          `${presetText(preset, 'name')} — ${i18n[lang].fireBreathAutoLimit(preset.autoLimitCycles)}`,
        ),
      300,
    );
  } else {
    applyLimit('none', 10);
  }

  playSelectChime();
  closeModal('modal-tecnicas');

  // Restart session with new technique if one is active
  if (isRunning()) {
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
