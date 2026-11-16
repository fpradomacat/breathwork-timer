// ── Practice UI ───────────────────────────────────────────────
//
// Everything the user sees about their practice:
//   - the streak in the stats row (opens the history modal)
//   - the end-of-session summary (with the "how do you feel?" question)
//   - the history modal (streak, totals, recent sessions)
//
// Data lives in history.js; this module only renders it.

import { i18n } from './i18n.js';
import { PRESETS } from './presets.js';
import { lang, presetText, formatTime, openModal, closeModal } from './ui.js';
import { addSession, setMood, getStats, MIN_RECORDED_SECS } from './history.js';

const MOOD_EMOJI = { calmer: '😌', same: '😐', energized: '⚡' };

let _lastEntryId = null;

/** Refresh the streak value in the stats row. */
export function renderStreak() {
  const { streak } = getStats({ recent: 0 });
  document.getElementById('streak-value').textContent =
    streak > 0 ? `🔥 ${streak}` : '--';
}

/**
 * Called when a session ends. Records it (if long enough) and shows
 * the summary.
 * @param {object} result — { secs, cycles, limitReached, limitMsg }
 * @param {object} preset — technique used during the session
 * @param {boolean} [silent] — record without showing the summary
 */
export function handleSessionEnd(result, preset, silent = false) {
  if (result.secs < MIN_RECORDED_SECS) return;

  const entry = addSession({
    secs: result.secs,
    cycles: result.cycles,
    technique: preset.soundDir,
  });
  _lastEntryId = entry.id;
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
  const mood = document.getElementById('mood');
  mood.classList.remove('answered');
  mood
    .querySelectorAll('.mood-btn')
    .forEach((b) => b.classList.remove('selected'));

  openModal('modal-summary');
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
        <span class="history-mood" aria-hidden="true">${MOOD_EMOJI[e.mood] || ''}</span>
      </li>`;
    })
    .join('');
}

/** Wire up the streak button, history modal and mood buttons. */
export function initPractice() {
  renderStreak();

  document.getElementById('streak-btn').addEventListener('click', () => {
    _renderHistory();
    openModal('modal-history');
  });

  document.querySelectorAll('#mood .mood-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (_lastEntryId) setMood(_lastEntryId, btn.dataset.mood);
      btn.classList.add('selected');
      document.getElementById('mood').classList.add('answered');
      setTimeout(() => closeModal('modal-summary'), 900);
    });
  });
}

/** Re-render practice texts after a language change. */
export function refreshPracticeLang() {
  renderStreak();
  if (document.getElementById('modal-history').classList.contains('open'))
    _renderHistory();
}
