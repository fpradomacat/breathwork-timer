// ── UI ────────────────────────────────────────────────────────
//
// Handles everything that touches the DOM but is not part of the
// breathing session timing logic:
//   - i18n / language switching
//   - Modal open / close
//   - Toast notifications
//   - Preset cards rendering
//   - Session limit badge
//   - Technique label

import { i18n } from './i18n.js';
import { PRESETS } from './presets.js';
import { loadTechniqueLoops, invalidateLoopCache } from './loop.js';
import { playSelectChime } from './audio.js';

// ── Language ──────────────────────────────────────────────────
export let lang = 'es';

/**
 * Apply a language to the whole UI.
 * Updates all [data-i18n] elements, the lang button, the technique
 * label, the preset descriptions, and the page title.
 *
 * @param {string}   l              — 'es' | 'en'
 * @param {boolean}  isRunning      — current session state (to avoid overwriting breath text)
 * @param {string}   activeTechniqueName
 * @param {Function} onTechniqueReloaded  — called after loadTechniqueLoops resolves
 */
export function applyLang(
  l,
  isRunning,
  activeTechniqueName,
  onTechniqueReloaded,
) {
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

  if (!isRunning) {
    document.getElementById('breath-text').textContent = t.ready;
  }

  // Re-translate technique label if it matches a preset name
  const techniqueLabel = document.getElementById('technique-label');
  const isCustom = techniqueLabel.classList.contains('is-custom');
  if (!isCustom && activeTechniqueName) {
    const preset = PRESETS.find(
      (p) =>
        p.nameEs === activeTechniqueName || p.nameEn === activeTechniqueName,
    );
    if (preset) {
      const newName = l === 'es' ? preset.nameEs : preset.nameEn;
      techniqueLabel.textContent = newName;
      // Reload loops so the helper track uses the new language next session
      invalidateLoopCache();
      loadTechniqueLoops(preset, l).then(() => onTechniqueReloaded?.(newName));
    } else {
      techniqueLabel.textContent = activeTechniqueName;
    }
  } else if (isCustom) {
    techniqueLabel.textContent = t.custom;
  }

  if (document.getElementById('presets-list')) renderPresets();
  document.title = t.title;
  updateLimitBadge();
}

// ── Technique label ───────────────────────────────────────────

/**
 * Set the technique label in the meta-row.
 * @param {string}  name
 * @param {boolean} isCustom — shows i18n 'custom' text instead of the name
 */
export function setTechniqueLabel(name, isCustom = false) {
  const el = document.getElementById('technique-label');
  el.textContent = isCustom ? i18n[lang].custom : name;
  el.classList.toggle('is-custom', isCustom);
}

// ── Session limit ─────────────────────────────────────────────
export let limitType = 'none';
export let limitValue = 10;

/** Set a session limit and update the badge. */
export function applyLimit(type, value) {
  limitType = type;
  limitValue = value;
  updateLimitBadge();
}

/** Check whether the current session has hit its limit. */
export function checkLimit(totalSeconds, cycles) {
  if (limitType === 'none') return false;
  if (limitType === 'minutes' && totalSeconds >= limitValue * 60) return true;
  if (limitType === 'cycles' && cycles >= limitValue) return true;
  return false;
}

/** Refresh the limit badge in the meta-row. */
export function updateLimitBadge() {
  const badge = document.getElementById('limit-badge');
  if (!badge) return;
  if (limitType === 'none') {
    badge.textContent = '';
    badge.style.display = 'none';
    return;
  }
  const t = i18n[lang];
  badge.textContent =
    limitType === 'minutes'
      ? t.limitBadgeMin(limitValue)
      : t.limitBadgeCyc(limitValue);
  badge.style.display = 'inline-flex';
}

// ── Modals ────────────────────────────────────────────────────
export function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  const body = el.querySelector('.modal-body');
  if (body) body.scrollTop = 0;
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

export function initModalListeners() {
  // Close button inside each modal
  document
    .querySelectorAll('.modal-close')
    .forEach((btn) =>
      btn.addEventListener('click', () => closeModal(btn.dataset.close)),
    );
  // Click on the dark overlay backdrop
  document.querySelectorAll('.modal-overlay').forEach((el) =>
    el.addEventListener('click', (e) => {
      if (e.target === el) closeModal(el.id);
    }),
  );
}

// ── Toast ─────────────────────────────────────────────────────
const _toastEl = (() => {
  const el = document.createElement('div');
  el.className = 'limit-toast';
  document.body.appendChild(el);
  return el;
})();

let _toastTimer = null;

export function showToast(msg) {
  _toastEl.textContent = msg;
  _toastEl.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => _toastEl.classList.remove('show'), 3500);
}

// ── Preset cards ──────────────────────────────────────────────

/**
 * Render the technique cards into #presets-list.
 * @param {Function} onSelect — callback(preset) when user picks a technique
 */
export function renderPresets(onSelect) {
  const list = document.getElementById('presets-list');
  if (!list) return;
  list.innerHTML = '';

  PRESETS.forEach((preset) => {
    const [i, hf, e, he] = preset.timing;
    const card = document.createElement('div');
    card.className = 'preset-card';

    const presetName = lang === 'es' ? preset.nameEs : preset.nameEn;
    const presetTag = lang === 'es' ? preset.tagEs : preset.tagEn;
    const presetDesc = lang === 'es' ? preset.descEs : preset.descEn;

    card.innerHTML = `
      <div class="preset-header">
        <span class="preset-name">${presetName} <span class="preset-tag">${presetTag}</span></span>
        <span class="preset-timing">${i}-${hf}-${e}-${he}</span>
      </div>
      <p class="preset-desc">${presetDesc}</p>`;

    card.addEventListener('click', () => onSelect?.(preset));
    list.appendChild(card);
  });
}

// ── Helpers ───────────────────────────────────────────────────
export function formatTime(s) {
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export function setCircleState(state) {
  const circle = document.getElementById('breathing-circle');
  circle.classList.remove('idle', 'collapsed', 'active');
  if (state !== 'idle') circle.classList.add(state);
}
