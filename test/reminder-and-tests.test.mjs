// Unit tests for the daily reminder (calendar events) and the
// breathing tests' scoring and storage.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const R = await import('../assets/js/reminder-ics.js');
const T = await import('../assets/js/breath-test-data.js');

beforeEach(() => localStorage.clear());

// ── Reminder ──────────────────────────────────────────────────
test('reminder slots: every half hour, 00:00 to 23:30', () => {
  assert.equal(R.REMINDER_SLOTS.length, 48);
  assert.equal(R.REMINDER_SLOTS[0], '00:00');
  assert.equal(R.REMINDER_SLOTS[17], '08:30');
  assert.equal(R.REMINDER_SLOTS.at(-1), '23:30');
});

test('icsPath matches the files build.js writes', () => {
  assert.equal(R.icsPath('es', '08:00'), '/reminder/es/0800.ics');
  assert.equal(R.icsPath('en', '21:30'), '/reminder/en/2130.ics');
});

test('buildIcs: daily event at the chosen local time, with an alert', () => {
  const ics = R.buildIcs({
    time: '07:30',
    lang: 'es',
    startDate: new Date(2026, 10, 16, 15),
  });
  const lines = ics.split('\r\n');
  assert.ok(lines.includes('DTSTART:20261116T073000'), 'floating local time');
  assert.ok(lines.includes('RRULE:FREQ=DAILY'));
  assert.ok(lines.includes('TRIGGER:PT0M'));
  assert.ok(lines.includes('UID:neyen-daily-es-0730@neyenbreath.netlify.app'));
  assert.match(ics, /^DTSTAMP:\d{8}T\d{6}Z$/m, 'DTSTAMP in UTC');
  assert.match(ics, /SUMMARY:Respirar con Neyen/);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  // Folded lines stay short (RFC 5545: 75 octets)
  for (const line of lines)
    assert.ok(Buffer.byteLength(line) <= 75, `too long: ${line}`);
});

test('googleCalendarUrl starts today if the time is still ahead', () => {
  const now = new Date(2026, 10, 16, 7, 0);
  const url = new URL(R.googleCalendarUrl({ time: '08:00', lang: 'en', now }));
  assert.equal(url.hostname, 'calendar.google.com');
  assert.equal(
    url.searchParams.get('dates'),
    '20261116T080000/20261116T081000',
  );
  assert.equal(url.searchParams.get('recur'), 'RRULE:FREQ=DAILY');
  assert.match(url.searchParams.get('text'), /Breathe with Neyen/);
});

test('googleCalendarUrl moves to tomorrow if the time has passed', () => {
  const now = new Date(2026, 10, 16, 9, 0);
  const url = new URL(R.googleCalendarUrl({ time: '08:00', lang: 'es', now }));
  assert.equal(
    url.searchParams.get('dates'),
    '20261117T080000/20261117T081000',
  );
});

// ── Breathing tests ───────────────────────────────────────────
const bolt = T.TESTS.find((t) => t.id === 'bolt');

test('bandIndex: upper bounds are exclusive, the last band is open', () => {
  assert.equal(T.bandIndex(bolt, 0), 0);
  assert.equal(T.bandIndex(bolt, 9.9), 0);
  assert.equal(T.bandIndex(bolt, 10), 1);
  assert.equal(T.bandIndex(bolt, 25), 2);
  assert.equal(T.bandIndex(bolt, 40), 3);
  assert.equal(T.bandIndex(bolt, 500), 3);
});

test('results are stored per test, most recent first', () => {
  T.addResult('bolt', 18.2);
  T.addResult('exhale', 41);
  T.addResult('bolt', 22.5);
  assert.deepEqual(
    T.resultsOf('bolt').map((r) => r.secs),
    [22.5, 18.2],
  );
  assert.equal(T.resultsOf('exhale').length, 1);
});

test('unreadable test results fall back to none', () => {
  localStorage.setItem('neyen.tests', '{oops');
  assert.deepEqual(T.resultsOf('bolt'), []);
});
