// ── Practice history ──────────────────────────────────────────
//
// Completed sessions are kept in localStorage (no accounts, nothing
// leaves the device). Used for the streak, totals and the history list.
//
// Entry: { id, date (ISO), secs, cycles, technique (preset.soundDir),
//          moodBefore, moodAfter }
//   moodBefore / moodAfter: null | 1–5 (bad → great), asked before the
//   session (check-in) and in the summary after it.
//   Older entries may have `mood: 'calmer' | 'same' | 'energized'` instead.

import { load, save } from './storage.js';

const KEY = 'history';
const MAX_ENTRIES = 500;

/** Sessions shorter than this aren't recorded (accidental taps). */
export const MIN_RECORDED_SECS = 30;

function _all() {
  const list = load(KEY, []);
  return Array.isArray(list) ? list : [];
}

/** Local calendar day, e.g. "2026-11-16" (streaks follow the user's days). */
function _dayKey(date) {
  const d = new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Record a finished session. Returns the stored entry. */
export function addSession({ secs, cycles, technique, moodBefore = null }) {
  const list = _all();
  const entry = {
    // Unique even if two sessions are saved within the same millisecond
    id: Math.max(Date.now(), (list.at(-1)?.id || 0) + 1),
    date: new Date().toISOString(),
    secs,
    cycles,
    technique,
    moodBefore,
    moodAfter: null,
  };
  list.push(entry);
  save(KEY, list.slice(-MAX_ENTRIES));
  return entry;
}

/** Attach the after-session "how do you feel?" answer (1–5). */
export function setMoodAfter(id, value) {
  const list = _all();
  const entry = list.find((e) => e.id === id);
  if (!entry) return;
  entry.moodAfter = value;
  save(KEY, list);
}

/** Sessions with both answers, and how many of them ended better. */
function _moodShift(list) {
  const both = list.filter(
    (e) => Number.isFinite(e.moodBefore) && Number.isFinite(e.moodAfter),
  );
  return {
    compared: both.length,
    improved: both.filter((e) => e.moodAfter > e.moodBefore).length,
  };
}

/**
 * Consecutive days with at least one session, counting back from today.
 * If there's no session today yet, the streak is still alive from yesterday.
 */
function _streak(list, now = new Date()) {
  const days = new Set(list.map((e) => _dayKey(e.date)));
  const cursor = new Date(now);
  if (!days.has(_dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(_dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Aggregates for the UI. */
export function getStats({ recent = 10 } = {}) {
  const list = _all();
  return {
    streak: _streak(list),
    sessions: list.length,
    totalMinutes: Math.round(list.reduce((s, e) => s + e.secs, 0) / 60),
    recent: list.slice(-recent).reverse(),
    ..._moodShift(list),
  };
}

// Exposed for tests
export const _internal = { _streak, _dayKey };
