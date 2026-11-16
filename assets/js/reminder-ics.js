// ── Daily reminder: calendar events ───────────────────────────
//
// The web can't schedule local notifications without a server, so the
// daily reminder is a recurring event in the user's own calendar:
//   - Google Calendar: a "create event" link (any time, opens prefilled)
//   - Apple / Outlook: a static .ics file per half hour and language,
//     written by build.js to /reminder/<lang>/<HHMM>.ics. A real https
//     URL is what makes iOS show its "Add to Calendar" sheet.
//
// Pure functions only (no DOM), so build.js and the tests can use them.

import { i18n } from './i18n.js';

export const SITE = 'https://neyenbreath.netlify.app/';

/** "00:00", "00:30" … "23:30": the times the reminder can be set to. */
export const REMINDER_SLOTS = Array.from(
  { length: 48 },
  (_, i) =>
    `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`,
);

/** Where build.js writes (and the app links) the .ics for a slot. */
export function icsPath(lang, time) {
  return `/reminder/${lang}/${time.replace(':', '')}.ics`;
}

const pad = (n) => String(n).padStart(2, '0');

/** Local "floating" date-time, e.g. 20261117T080000 (the device's time zone). */
function _stamp(d) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

/** UTC date-time, e.g. 20261117T110000Z (DTSTAMP must be UTC). */
function _utc(d) {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** Escape text for an iCalendar value. */
function _esc(s) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/([,;])/g, '\\$1');
}

/** Fold long lines (RFC 5545 asks for ≤ 75 octets; 60 chars keeps emoji safe). */
function _fold(line) {
  const chars = [...line];
  const out = [];
  for (let i = 0; i < chars.length; i += 60)
    out.push((i ? ' ' : '') + chars.slice(i, i + 60).join(''));
  return out.join('\r\n');
}

/**
 * A daily recurring event at `time`, with an alert at that moment.
 * Floating time (no time zone), so it follows the device's clock.
 * @param {object} o
 * @param {string} o.time      — "HH:MM"
 * @param {string} o.lang      — 'es' | 'en'
 * @param {Date}   o.startDate — first day of the series
 * @param {string} [o.siteUrl]
 */
export function buildIcs({ time, lang, startDate, siteUrl = SITE }) {
  const t = i18n[lang];
  const [h, m] = time.split(':').map(Number);
  const start = new Date(startDate);
  start.setHours(h, m, 0, 0);
  const slot = time.replace(':', '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Neyen//Daily reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // Same id for the same slot: importing it again updates, not duplicates
    `UID:neyen-daily-${lang}-${slot}@neyenbreath.netlify.app`,
    `DTSTAMP:${_utc(new Date(startDate))}`,
    `DTSTART:${_stamp(start)}`,
    'DURATION:PT10M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${_esc(t.icsSummary)}`,
    `DESCRIPTION:${_esc(`${t.icsDescription}\n${siteUrl}`)}`,
    `URL:${siteUrl}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${_esc(t.icsSummary)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(_fold).join('\r\n') + '\r\n';
}

/**
 * Google Calendar "create event" link for a daily event at `time`,
 * starting today if that time hasn't passed yet, otherwise tomorrow.
 */
export function googleCalendarUrl({ time, lang, now = new Date() }) {
  const t = i18n[lang];
  const [h, m] = time.split(':').map(Number);
  const start = new Date(now);
  start.setHours(h, m, 0, 0);
  if (start <= now) start.setDate(start.getDate() + 1);
  const end = new Date(start.getTime() + 10 * 60 * 1000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: t.icsSummary,
    details: `${t.icsDescription}\n${SITE}`,
    dates: `${_stamp(start)}/${_stamp(end)}`,
    recur: 'RRULE:FREQ=DAILY',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
