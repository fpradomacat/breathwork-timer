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
import { load, save } from './storage.js';

// ── Language ──────────────────────────────────────────────────
// Saved choice → browser language → English
function _initialLang() {
  const saved = load('lang', null);
  if (saved in i18n) return saved;
  const browser = (navigator.language || '').slice(0, 2).toLowerCase();
  return browser in i18n ? browser : 'en';
}
export let lang = _initialLang();

/** Localized value of a preset field, e.g. presetText(p, 'name') → p.nameEs */
export function presetText(preset, field) {
  return preset[field + (lang === 'es' ? 'Es' : 'En')];
}

/**
 * Apply a language to the static UI: every [data-i18n] element,
 * icon-button labels, the page title and the preset cards.
 * Technique audio/label updates are handled by the caller (main.js).
 * @param {string} l — 'es' | 'en'
 */
export function applyLang(l) {
  lang = l;
  save('lang', l);
  const t = i18n[l];
  document.documentElement.lang = l;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (t[key] && typeof t[key] === 'string') el.textContent = t[key];
  });

  // Icon-only buttons: translate their accessible label + tooltip
  document.querySelectorAll('[data-i18n-label]').forEach((el) => {
    const label = t[el.dataset.i18nLabel];
    if (typeof label !== 'string') return;
    el.setAttribute('aria-label', label);
    el.title = label;
  });

  renderPresets();
  document.title = t.title;
  updateLimitBadge();
}

// ── Technique label ───────────────────────────────────────────

/** Show the active technique's (localized) name in the meta-row. */
export function setTechniqueLabel(preset) {
  document.getElementById('technique-label').textContent = presetText(
    preset,
    'name',
  );
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

/**
 * Refresh everything that shows the limit:
 *   - the badge in the meta-row (visible during the session)
 *   - the duration pill next to "Techniques" (visible before it)
 */
export function updateLimitBadge() {
  const t = i18n[lang];
  const text =
    limitType === 'minutes'
      ? t.limitBadgeMin(limitValue)
      : limitType === 'cycles'
        ? t.limitBadgeCyc(limitValue)
        : '';

  const badge = document.getElementById('limit-badge');
  if (badge) {
    badge.textContent = text;
    badge.hidden = limitType === 'none';
  }

  const pill = document.getElementById('duration-btn');
  if (pill) {
    // Cycle limits come from the technique itself and can't be changed here
    const locked = limitType === 'cycles';
    pill.textContent = limitType === 'none' ? t.durationFree : text;
    pill.setAttribute('aria-disabled', String(locked));
    pill.classList.toggle('locked', locked);
  }
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

// Remembered so re-renders (e.g. on language change) keep the click handler
let _onPresetSelect = null;

/**
 * Render the technique cards into #presets-list.
 * @param {Function} [onSelect] — callback(preset) when user picks a technique
 *                               (omit to reuse the previous one)
 */
export function renderPresets(onSelect) {
  if (onSelect) _onPresetSelect = onSelect;
  const list = document.getElementById('presets-list');
  if (!list) return;
  list.innerHTML = '';

  PRESETS.forEach((preset) => {
    const card = document.createElement('div');
    card.className = 'preset-card';
    card.innerHTML = `
      <div class="preset-header">
        <span class="preset-name">${presetText(preset, 'name')} <span class="preset-tag">${presetText(preset, 'tag')}</span></span>
        <span class="preset-timing">${preset.timing.join('-')}</span>
      </div>
      <p class="preset-desc">${presetText(preset, 'desc')}</p>`;

    card.addEventListener('click', () => _onPresetSelect?.(preset));
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
