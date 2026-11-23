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
import { PRESETS, GOALS } from './presets.js';
import { load, save } from './storage.js';
import { SEO, renderSeo } from './seo-content.js';

// ── Language ──────────────────────────────────────────────────
// Page language (a built language page) → saved choice → browser → English.
// build.js publishes one page per language and marks each with
// data-page-lang; that page is what Google indexed and what the user
// clicked, so it wins over any previously saved choice. In development
// (no build) the attribute is absent and the old order applies.
function _initialLang() {
  const page = document.documentElement.dataset.pageLang;
  if (page in i18n) return page;
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
  renderSeoContent(l);
  // The <title> is a search result, not UI: use the descriptive one, the
  // same string build.js writes into the static page for this language.
  document.title = SEO[l].metaTitle;
  updateLimitBadge();
}

// ── Landing content ───────────────────────────────────────────
/**
 * (Re)render the prose under the app in a language.
 * build.js already wrote it as static HTML, so in production this
 * replaces it with an identical copy; it matters when the user switches
 * language, and when the repo root is served with no build at all.
 */
function renderSeoContent(l) {
  const el = document.getElementById('info');
  if (!el) return;
  // data-href is only set by build.js, so it marks a built site — the one
  // place where the other language's page exists to link to.
  const built = Boolean(document.getElementById('lang-btn')?.dataset.href);
  el.innerHTML = renderSeo(l, { linkAlternate: built });
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
// Focus moves into the dialog when it opens and back to whatever opened
// it when it closes (keyboard and screen-reader users don't get lost).
const _returnFocus = new Map();

/**
 * Freeze the page behind an open dialog. The page scrolls now (the
 * landing content sits under the app), and scrolling it while a modal is
 * up means scrolling something you can't see.
 */
function _syncScrollLock() {
  document.body.classList.toggle(
    'modal-open',
    Boolean(document.querySelector('.modal-overlay.open')),
  );
}

export function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  _returnFocus.set(id, document.activeElement);
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
  const body = el.querySelector('.modal-body');
  if (body) body.scrollTop = 0;
  _syncScrollLock();
  // Focus the first control after the open transition starts
  setTimeout(
    () => el.querySelector('.modal-close')?.focus({ preventScroll: true }),
    50,
  );
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (!el || !el.classList.contains('open')) return;
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
  _syncScrollLock();
  const back = _returnFocus.get(id);
  _returnFocus.delete(id);
  if (back && document.contains(back) && back !== document.body)
    back.focus({ preventScroll: true });
  else document.activeElement?.blur?.();
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

_toastEl.setAttribute('role', 'status');

let _toastTimer = null;

/**
 * Show a short message at the bottom of the screen.
 * @param {string} msg
 * @param {object} [opts]
 * @param {string}   [opts.actionLabel] — adds a button to the toast
 * @param {Function} [opts.onAction]
 * @param {boolean}  [opts.sticky]      — stays until the action is used
 */
export function showToast(msg, { actionLabel, onAction, sticky = false } = {}) {
  _toastEl.textContent = msg;
  _toastEl.classList.toggle('actionable', Boolean(actionLabel));
  if (actionLabel) {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = actionLabel;
    btn.addEventListener('click', () => {
      _toastEl.classList.remove('show');
      onAction?.();
    });
    _toastEl.appendChild(btn);
  }
  _toastEl.classList.add('show');
  clearTimeout(_toastTimer);
  if (!sticky)
    _toastTimer = setTimeout(() => _toastEl.classList.remove('show'), 3500);
}

// ── Preset cards ──────────────────────────────────────────────
// Goal-first: the modal asks "what do you need?" and each card leads
// with the goal (Calm, Sleep…), then the technique that serves it.

// Remembered so re-renders (e.g. on language change) keep the click
// handler and the highlighted technique
let _onPresetSelect = null;
let _activePreset = null;

/**
 * Render the technique cards into #presets-list, in GOALS order.
 * @param {Function} [onSelect] — callback(preset) when user picks a technique
 *                               (omit to reuse the previous one)
 * @param {object}   [active]   — the technique in use (highlighted)
 */
export function renderPresets(onSelect, active) {
  if (onSelect) _onPresetSelect = onSelect;
  if (active) _activePreset = active;
  const list = document.getElementById('presets-list');
  if (!list) return;
  list.innerHTML = '';
  const t = i18n[lang];

  GOALS.forEach((goal) => {
    PRESETS.filter((p) => p.goal === goal.id).forEach((preset) => {
      const card = document.createElement('div');
      card.className = 'preset-card';
      card.setAttribute('role', 'button');
      card.setAttribute('aria-current', String(preset === _activePreset));
      card.tabIndex = 0;
      card.innerHTML = `
      <div class="preset-goal"><span class="preset-goal-emoji" aria-hidden="true">${goal.emoji}</span>${t[goal.label]}</div>
      <div class="preset-technique">
        <span class="preset-name">${presetText(preset, 'name')}</span>
        <span class="preset-timing">${preset.timing.join('-')}</span>
      </div>
      <p class="preset-desc">${presetText(preset, 'desc')}</p>${
        preset.warnEs
          ? `<p class="preset-warn"><span aria-hidden="true">⚠️</span> ${presetText(preset, 'warn')}</p>`
          : ''
      }`;

      card.addEventListener('click', () => _onPresetSelect?.(preset));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation(); // Space must not also start/stop the session
          _onPresetSelect?.(preset);
        }
      });
      list.appendChild(card);
    });
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
