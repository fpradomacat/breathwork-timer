// ── Practice UI ───────────────────────────────────────────────
//
// Everything the user sees about their practice:
//   - the streak in the stats row (opens the history modal)
//   - the check-in before a session ("how are you feeling?", 1–5)
//   - the end-of-session summary (same question after the session)
//   - the history modal (streak, totals, before/after insight, recent
//     sessions, and the entry points to the tests and the reminder)
//
// Data lives in history.js; this module only renders it.

import { i18n } from './i18n.js';
import { PRESETS } from './presets.js';
import {
  lang,
  presetText,
  formatTime,
  openModal,
  closeModal,
  showToast,
} from './ui.js';
import {
  addSession,
  setMoodAfter,
  getStats,
  MIN_RECORDED_SECS,
} from './history.js';
import { load, save } from './storage.js';
import { openTests } from './breath-tests.js';
import { openReminder, hasReminder } from './reminder.js';

// 1 (bad) → 5 (great). Same scale before and after the session, so the
// two answers can be compared.
const MOOD_SCALE = [1, 2, 3, 4, 5];
const MOOD_EMOJI = { 1: '😣', 2: '😕', 3: '😐', 4: '🙂', 5: '😌' };
// Answers saved before the 1–5 scale existed
const LEGACY_MOOD_EMOJI = { calmer: '😌', same: '😐', energized: '⚡' };

// Offer the daily reminder after a session at most this many times
const REMINDER_OFFERS = 3;

let _lastEntryId = null;
let _lastMoodBefore = null;
let _pendingMoodBefore = null; // check-in answer for the session about to start

// ── Mood scale buttons ────────────────────────────────────────
function _renderScale(container) {
  const t = i18n[lang];
  container.innerHTML = MOOD_SCALE.map(
    (v) =>
      `<button class="mood-btn" data-value="${v}"><span class="mood-emoji" aria-hidden="true">${MOOD_EMOJI[v]}</span><span>${t['mood' + v]}</span></button>`,
  ).join('');
}

function _renderScales() {
  document.querySelectorAll('.mood-options').forEach(_renderScale);
}

// ── Check-in (before the session) ─────────────────────────────
export const checkInEnabled = () => load('checkIn', true);
const _checkInEnabled = checkInEnabled;

let _startAfterCheckIn = null;

/**
 * Start a session, asking "how are you feeling?" first (unless the user
 * turned the question off). `start` must be called synchronously inside
 * a tap (see session.js 'starting'), so it runs from the answer's click.
 *
 * At most one dialog comes before a session: a technique's safety note
 * that hasn't been shown yet (`warning`, { name, text }) is shown inside
 * this one instead of in a dialog of its own. With the question turned
 * off, main.js shows the note alone in its place.
 */
export function startWithCheckIn(start, warning = null) {
  _pendingMoodBefore = null;
  if (!_checkInEnabled()) {
    start();
    return;
  }
  const note = document.getElementById('checkin-warning');
  const dialog = document.querySelector('#modal-checkin [role="dialog"]');
  note.hidden = !warning;
  if (warning) {
    document.getElementById('checkin-warning-technique').textContent =
      warning.name;
    document.getElementById('checkin-warning-text').textContent = warning.text;
    // Read out with the dialog's title, not left for the user to find
    dialog.setAttribute('aria-describedby', 'checkin-warning');
  } else dialog.removeAttribute('aria-describedby');
  _startAfterCheckIn = start;
  openModal('modal-checkin');
}

function _finishCheckIn(value) {
  _pendingMoodBefore = value;
  const start = _startAfterCheckIn;
  _startAfterCheckIn = null;
  closeModal('modal-checkin');
  start?.();
}

// ── Streak ────────────────────────────────────────────────────
/** Refresh the streak value in the stats row. */
export function renderStreak() {
  const t = i18n[lang];
  const { streak } = getStats({ recent: 0 });
  // Always "N días" — a bare "--" read as an error or as nothing at all
  const days = t.streakValue(streak);
  const value = document.getElementById('streak-value');
  value.textContent = days;
  value.classList.toggle('stat-value--zero', streak === 0);
  // Name = what it shows + what it opens ("Racha: 3 días. Ver tu práctica")
  const btn = document.getElementById('streak-btn');
  const label = `${t.statStreak}: ${days}. ${t.historyOpen}`;
  btn.setAttribute('aria-label', label);
  btn.title = label;
}

// ── Summary (after the session) ───────────────────────────────
/**
 * Called when a session ends. Records it (if long enough) and shows
 * the summary.
 * @param {object} result — { secs, cycles, limitReached, limitMsg }
 * @param {object} preset — technique used during the session
 * @param {boolean} [silent] — record without showing the summary
 */
export function handleSessionEnd(result, preset, silent = false) {
  const moodBefore = _pendingMoodBefore;
  _pendingMoodBefore = null;
  if (result.secs < MIN_RECORDED_SECS) return;

  const entry = addSession({
    secs: result.secs,
    cycles: result.cycles,
    technique: preset.soundDir,
    moodBefore,
  });
  _lastEntryId = entry.id;
  _lastMoodBefore = moodBefore;
  renderStreak();
  if (silent) return;

  const t = i18n[lang];
  const stats = getStats({ recent: 0 });

  const limitEl = document.getElementById('summary-limit');
  limitEl.hidden = !result.limitReached;
  limitEl.textContent = result.limitMsg || '';
  document.getElementById('summary-time').textContent = formatTime(result.secs);
  document.getElementById('summary-cycles').textContent = result.cycles;
  document.getElementById('summary-technique').textContent = presetText(
    preset,
    'name',
  );
  document.getElementById('summary-streak').textContent =
    `${t.streakDays(stats.streak)} · ${t.totalMinutes(stats.totalMinutes, stats.sessions)}`;

  // Reset the mood question
  const before = document.getElementById('mood-before');
  before.hidden = !moodBefore;
  before.textContent = moodBefore ? t.moodBefore(MOOD_EMOJI[moodBefore]) : '';
  const mood = document.getElementById('mood');
  mood.classList.remove('answered');
  mood
    .querySelectorAll('.mood-btn')
    .forEach((b) => b.classList.remove('selected'));
  document.getElementById('mood-thanks').textContent = t.moodThanks;

  openModal('modal-summary');
}

function _onMoodAfter(btn) {
  const value = Number(btn.dataset.value);
  if (_lastEntryId) setMoodAfter(_lastEntryId, value);
  btn.classList.add('selected');
  const t = i18n[lang];
  document.getElementById('mood-thanks').textContent =
    _lastMoodBefore && value > _lastMoodBefore ? t.moodBetter : t.moodThanks;
  document.getElementById('mood').classList.add('answered');
  setTimeout(() => {
    closeModal('modal-summary');
    _maybeOfferReminder();
  }, 1100);
}

/** After a couple of sessions, offer the daily reminder (a few times at most). */
function _maybeOfferReminder() {
  if (hasReminder()) return;
  const offered = load('reminderOffers', 0);
  if (offered >= REMINDER_OFFERS || getStats({ recent: 0 }).sessions < 2)
    return;
  save('reminderOffers', offered + 1);
  const t = i18n[lang];
  setTimeout(
    () =>
      showToast(t.reminderOffer, {
        actionLabel: t.reminderOfferYes,
        onAction: openReminder,
      }),
    400,
  );
}

// ── History modal ─────────────────────────────────────────────
function _moodCell(e) {
  if (Number.isFinite(e.moodBefore) || Number.isFinite(e.moodAfter)) {
    const b = MOOD_EMOJI[e.moodBefore] || '';
    const a = MOOD_EMOJI[e.moodAfter] || '';
    return b && a ? `${b}→${a}` : a || b;
  }
  return LEGACY_MOOD_EMOJI[e.mood] || '';
}

function _renderHistory() {
  const t = i18n[lang];
  const stats = getStats({ recent: 10 });

  document.getElementById('history-tiles').innerHTML = [
    [stats.streak, t.historyStreak],
    [stats.sessions, t.historySessions],
    [stats.totalMinutes, t.historyMinutes],
  ]
    .map(
      ([value, label]) =>
        `<div class="history-tile"><span class="history-tile-value">${value}</span><span class="history-tile-label">${label}</span></div>`,
    )
    .join('');

  const insight = document.getElementById('history-insight');
  insight.hidden = stats.compared === 0;
  insight.textContent = stats.compared
    ? t.historyImproved(stats.improved, stats.compared)
    : '';

  document
    .getElementById('checkin-switch')
    .setAttribute('aria-checked', String(_checkInEnabled()));

  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  empty.hidden = stats.recent.length > 0;
  const fmt = new Intl.DateTimeFormat(lang, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  list.innerHTML = stats.recent
    .map((e) => {
      const preset = PRESETS.find((p) => p.soundDir === e.technique);
      const name = preset ? presetText(preset, 'name') : '';
      return `<li class="history-item">
        <span class="history-date">${fmt.format(new Date(e.date))}</span>
        <span class="history-name">${name}</span>
        <span class="history-time">${formatTime(e.secs)}</span>
        <span class="history-mood" aria-hidden="true">${_moodCell(e)}</span>
      </li>`;
    })
    .join('');
}

/** Close the history modal, then open another one from it. */
function _switchTo(open) {
  closeModal('modal-history');
  setTimeout(open, 200);
}

/** Wire up the streak button, history modal, check-in and mood buttons. */
export function initPractice() {
  renderStreak();
  _renderScales();

  document.getElementById('streak-btn').addEventListener('click', () => {
    _renderHistory();
    openModal('modal-history');
  });

  // One listener per scale (the buttons are re-rendered on language change)
  document.getElementById('checkin-options').addEventListener('click', (e) => {
    const btn = e.target.closest('.mood-btn');
    if (btn) _finishCheckIn(Number(btn.dataset.value));
  });
  document
    .getElementById('checkin-skip')
    .addEventListener('click', () => _finishCheckIn(null));

  document.getElementById('mood-options').addEventListener('click', (e) => {
    const btn = e.target.closest('.mood-btn');
    if (btn && !document.getElementById('mood').classList.contains('answered'))
      _onMoodAfter(btn);
  });

  document.getElementById('checkin-switch').addEventListener('click', (e) => {
    const on = !_checkInEnabled();
    save('checkIn', on);
    e.currentTarget.setAttribute('aria-checked', String(on));
  });

  document
    .getElementById('open-tests')
    .addEventListener('click', () => _switchTo(openTests));
  document
    .getElementById('open-reminder')
    .addEventListener('click', () => _switchTo(openReminder));
}

/** Re-render practice texts after a language change. */
export function refreshPracticeLang() {
  renderStreak();
  _renderScales();
  if (document.getElementById('modal-history').classList.contains('open'))
    _renderHistory();
}
