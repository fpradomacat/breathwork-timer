// Unit tests for practice history (assets/js/history.js).

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const H = await import('../assets/js/history.js');
const { _streak } = H._internal;

beforeEach(() => localStorage.clear());

const day = (y, m, d, h = 12) => new Date(y, m - 1, d, h).toISOString();
const entries = (...dates) => dates.map((date) => ({ date, secs: 60 }));

test('streak counts consecutive days back from today', () => {
  const now = new Date(2026, 10, 16, 20);
  const list = entries(day(2026, 11, 14), day(2026, 11, 15), day(2026, 11, 16));
  assert.equal(_streak(list, now), 3);
});

test('streak is still alive if today has no session yet', () => {
  const now = new Date(2026, 10, 16, 8);
  const list = entries(day(2026, 11, 14), day(2026, 11, 15));
  assert.equal(_streak(list, now), 2);
});

test('a missed day breaks the streak', () => {
  const now = new Date(2026, 10, 16, 20);
  const list = entries(day(2026, 11, 13), day(2026, 11, 14), day(2026, 11, 16));
  assert.equal(_streak(list, now), 1);
});

test('several sessions on the same day count once', () => {
  const now = new Date(2026, 10, 16, 20);
  const list = entries(
    day(2026, 11, 16, 7),
    day(2026, 11, 16, 21),
    day(2026, 11, 15),
  );
  assert.equal(_streak(list, now), 2);
});

test('no sessions → streak 0', () => {
  assert.equal(_streak([], new Date()), 0);
});

test('addSession stores sessions; getStats aggregates them', () => {
  H.addSession({ secs: 300, cycles: 18, technique: 'box' });
  const e = H.addSession({ secs: 90, cycles: 9, technique: 'coherent' });
  const stats = H.getStats();
  assert.equal(stats.sessions, 2);
  assert.equal(stats.totalMinutes, 7); // 390 s
  assert.equal(stats.streak, 1);
  assert.equal(stats.recent[0].id, e.id, 'most recent first');
});

test('setMood attaches the answer to the session', () => {
  const e = H.addSession({ secs: 120, cycles: 10, technique: 'box' });
  H.setMood(e.id, 'calmer');
  assert.equal(H.getStats().recent[0].mood, 'calmer');
});

test('unreadable storage falls back to an empty history', () => {
  localStorage.setItem('neyen.history', '{not json');
  assert.equal(H.getStats().sessions, 0);
});
