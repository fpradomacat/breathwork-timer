// ── Lock-screen / notification controls (Media Session API) ───
//
// During a session the OS shows "Neyen · <technique>" with a stop button
// on the lock screen / notification shade, and the browser treats the
// page as playing media (which also makes background audio less likely
// to be cut).
//
// Browsers only show these controls while an HTMLMediaElement is
// playing — the app's own audio goes through Web Audio — so a looped
// silent <audio> is played alongside the session. It must be started
// from the user's tap (iOS), hence prime() on 'starting'.
//
// Best effort: every call is guarded; unsupported browsers just skip it.

let _el = null;

/** 1 s of 8 kHz mono 16-bit silence, as a WAV blob URL. */
function _silentWavUrl() {
  const sampleRate = 8000;
  const samples = sampleRate;
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  str(36, 'data');
  v.setUint32(40, samples * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

const _supported = () => 'mediaSession' in navigator;

/** Start the silent media element — call synchronously from the user's tap. */
export function primeMediaSession() {
  if (!_supported()) return;
  try {
    if (!_el) {
      _el = new Audio(_silentWavUrl());
      _el.loop = true;
    }
    _el.play().catch(() => {});
  } catch (_) {}
}

/**
 * Show the session on the lock screen.
 * @param {object} o
 * @param {string} o.title   — technique name
 * @param {string} o.album   — app title (localized)
 * @param {Function} o.onStop — called by the OS pause/stop buttons
 */
export function showMediaSession({ title, album, onStop }) {
  if (!_supported()) return;
  const ms = navigator.mediaSession;
  try {
    ms.metadata = new MediaMetadata({
      title,
      artist: 'Neyen',
      album,
      artwork: [
        { src: '/assets/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
    ms.playbackState = 'playing';
  } catch (_) {}
  for (const action of ['pause', 'stop']) {
    try {
      ms.setActionHandler(action, onStop);
    } catch (_) {
      // action not supported by this browser
    }
  }
}

/** Remove the lock-screen controls and stop the silent element. */
export function endMediaSession() {
  if (!_supported()) return;
  try {
    _el?.pause();
    navigator.mediaSession.playbackState = 'none';
    navigator.mediaSession.metadata = null;
  } catch (_) {}
  for (const action of ['pause', 'stop']) {
    try {
      navigator.mediaSession.setActionHandler(action, null);
    } catch (_) {}
  }
}
