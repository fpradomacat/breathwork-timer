// ── Daily reminder (modal) ────────────────────────────────────
//
// Pick a time, then add a daily event to Google Calendar or to the
// device calendar (.ics). See reminder-ics.js for why it's a calendar
// event and not a push notification.
//
// The chosen time is remembered in localStorage ("neyen.reminder").

import { i18n } from './i18n.js';
import { lang, openModal, closeModal, showToast } from './ui.js';
import { load, save } from './storage.js';
import {
  REMINDER_SLOTS,
  icsPath,
  buildIcs,
  googleCalendarUrl,
} from './reminder-ics.js';

const DEFAULT_TIME = '08:00';

/** True once the user has added a reminder (from either button). */
export function hasReminder() {
  return Boolean(load('reminder', null)?.time);
}

// The .ics files only exist in the build (dist/). When they're missing
// (running from the repo), the link downloads one generated on the spot.
let _staticIcs = null;
async function _checkStaticIcs() {
  if (_staticIcs !== null) return _staticIcs;
  try {
    const res = await fetch(`.${icsPath('es', DEFAULT_TIME)}`, {
      method: 'HEAD',
    });
    _staticIcs = res.ok;
  } catch {
    _staticIcs = false;
  }
  return _staticIcs;
}

let _blobUrl = null;

async function _updateLinks() {
  const time = document.getElementById('reminder-time').value;
  document.getElementById('reminder-google').href = googleCalendarUrl({
    time,
    lang,
  });
  const ics = document.getElementById('reminder-ics');
  if (await _checkStaticIcs()) {
    ics.href = `.${icsPath(lang, time)}`;
    ics.removeAttribute('download');
  } else {
    if (_blobUrl) URL.revokeObjectURL(_blobUrl);
    _blobUrl = URL.createObjectURL(
      new Blob([buildIcs({ time, lang, startDate: new Date() })], {
        type: 'text/calendar',
      }),
    );
    ics.href = _blobUrl;
    ics.download = 'neyen.ics';
  }
}

function _renderStatus() {
  const saved = load('reminder', null);
  const el = document.getElementById('reminder-current');
  el.hidden = !saved?.time;
  el.textContent = saved?.time ? i18n[lang].reminderCurrent(saved.time) : '';
}

function _onAdded() {
  save('reminder', { time: document.getElementById('reminder-time').value });
  _renderStatus();
  // Let the link open first, then leave the modal
  setTimeout(() => {
    closeModal('modal-reminder');
    showToast(i18n[lang].reminderDone);
  }, 300);
}

/** Open the reminder modal. */
export function openReminder() {
  const select = document.getElementById('reminder-time');
  const saved = load('reminder', null)?.time;
  select.value = REMINDER_SLOTS.includes(saved) ? saved : DEFAULT_TIME;
  _renderStatus();
  _updateLinks();
  openModal('modal-reminder');
}

export function initReminder() {
  const select = document.getElementById('reminder-time');
  select.innerHTML = REMINDER_SLOTS.map(
    (s) => `<option value="${s}">${s}</option>`,
  ).join('');
  select.value = DEFAULT_TIME;
  select.addEventListener('change', _updateLinks);
  document
    .getElementById('reminder-google')
    .addEventListener('click', _onAdded);
  document.getElementById('reminder-ics').addEventListener('click', _onAdded);
}

/** Refresh texts/links after a language change. */
export function refreshReminderLang() {
  if (document.getElementById('modal-reminder').classList.contains('open')) {
    _renderStatus();
    _updateLinks();
  }
}
