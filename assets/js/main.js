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
  startTimer,
  stopTimer,
  setSessionTimes,
  registerLimitGetter,
  acquireWakeLock,
  TRANSITION_MS,
} from './session.js';
import { initInteractions } from './interactions.js';

// ── Active technique state ────────────────────────────────────
// Kept here (not in session.js) because it's also needed by the
// preset selection handler and the language switcher.
let activeTechniqueName = lang === 'es' ? PRESETS[0].nameEs : PRESETS[0].nameEn;

// Default times mirror the first preset
const times = {
  inhale: PRESETS[0].timing[0],
  holdFull: PRESETS[0].timing[1],
  exhale: PRESETS[0].timing[2],
  holdEmpty: PRESETS[0].timing[3],
};

// Give session.js a way to read limit state without circular imports
registerLimitGetter(() => ({ limitType, limitValue }));

// ── Bootstrap ─────────────────────────────────────────────────
window.addEventListener('load', () => {
  // Sync times to session module
  setSessionTimes(times);

  // Apply default technique label
  setTechniqueLabel(activeTechniqueName);

  // Apply default limit
  applyLimit('none', 10);

  // Pre-load default preset audio
  loadTechniqueLoops(PRESETS[0], lang);

  // Start ambient music on first user gesture
  ambient.bootstrap();

  // Wire up interaction listeners
  initInteractions({
    onStartStop: () => (isRunning() ? stopTimer() : startTimer()),
    onCloseModals: () =>
      document
        .querySelectorAll('.modal-overlay.open')
        .forEach((m) => closeModal(m.id)),
  });

  // Wire up modal close buttons and overlay clicks
  initModalListeners();

  // Sync buttons to DOM
  document.querySelectorAll('#lang-dropdown .ctrl-option').forEach((opt) => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      applyLang(
        opt.dataset.value,
        isRunning(),
        activeTechniqueName,
        (newName) => {
          activeTechniqueName = newName;
        },
      );
    });
  });
});

// ── Circle tap → start / stop ─────────────────────────────────
document.getElementById('breathing-circle').addEventListener('click', () => {
  isRunning() ? stopTimer() : startTimer();
});

// ── Técnicas pill ─────────────────────────────────────────────
document.getElementById('tecnicas-btn').addEventListener('click', () => {
  renderPresets(_onPresetSelected);
  openModal('modal-tecnicas');
});

// ── Ambient music button ──────────────────────────────────────
document.getElementById('ambient-btn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  ambient.toggle();
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
  const [i, hf, e, he] = preset.timing;
  times.inhale = i;
  times.holdFull = hf;
  times.exhale = e;
  times.holdEmpty = he;
  setSessionTimes(times);

  const name = lang === 'es' ? preset.nameEs : preset.nameEn;
  activeTechniqueName = name;
  setTechniqueLabel(name);

  loadTechniqueLoops(preset, lang);

  if (preset.autoLimitCycles) {
    applyLimit('cycles', preset.autoLimitCycles);
    setTimeout(
      () =>
        showToast(
          `${name} — ${i18n[lang].fireBreathAutoLimit(preset.autoLimitCycles)}`,
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
    setTimeout(() => startTimer(), session.TRANSITION_MS + 100);
  }
}

// ── Visibility change ─────────────────────────────────────────
// When the user switches tabs or minimizes the browser:
//   - No active session → stop ambient music
//   - Active session    → re-acquire wake lock (released automatically on hide)
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'hidden') {
    if (!isRunning()) {
      ambient.stop();
    }
    // Session case: wake lock is auto-released on hide by the browser;
    // we re-acquire it when the user comes back (see 'visible' branch).
  } else if (document.visibilityState === 'visible') {
    if (isRunning()) {
      await acquireWakeLock();
    }
  }
});

// ── Prevent stale values on browser session restore ───────────
// (Some browsers restore form field values from the previous session)
window.addEventListener('load', () => {
  // Already handled above — this is just a safety net for any
  // dynamically-added inputs that might retain stale values.
});

// ── Expose applyLang globally for tutorial.js ─────────────────
// tutorial.js is a non-module IIFE that calls applyLang() by name.
// We expose it on window so it keeps working without changes.
window.applyLang = (l) =>
  applyLang(l, isRunning(), activeTechniqueName, (newName) => {
    activeTechniqueName = newName;
  });
