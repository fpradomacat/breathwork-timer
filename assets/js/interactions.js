// ── Interactions ──────────────────────────────────────────────
//
// All event listeners that produce audio/haptic feedback:
//   - Mouse hover → short click sound
//   - Touch start  → haptic vibration
//   - Mouse / touch click → click sound
//   - Keyboard     → Space (start/stop), Escape (close modals)
//
// These listeners are purely additive — they don't own any state
// beyond the debounce flags below, and they never start/stop a session
// directly. They call the callbacks passed to initInteractions().

import { playHoverClick } from './audio.js';

// Elements that get hover/click sounds
const INTERACTIVE_SELECTOR = [
  '#presets-btn',
  '.ctrl-option',
  '.input-group input',
  '.bmc-btn',
  '.author-tag',
  '.preset-card',
  '.modal-close',
  '#breathing-circle',
  '.pill-tecnicas',
].join(', ');

const CLICK_SOUND_SELECTOR = [
  'button:not(:disabled)',
  'a',
  '.preset-card',
  '.pill-tecnicas',
  '.modal-close',
  '.bmc-btn',
].join(', ');

// ── Debounce flags ────────────────────────────────────────────
let _lastHoverEl = null;
let _suppressHover = false;
let _lastWasTouch = false;

export function suppressHoverBriefly(ms = 600) {
  _suppressHover = true;
  setTimeout(() => {
    _suppressHover = false;
    _lastHoverEl = null;
  }, ms);
}

// ── Init ──────────────────────────────────────────────────────
/**
 * Wire up all interaction listeners.
 * @param {object} callbacks
 *   .onStartStop  — called when Space is pressed (no args)
 *   .onCloseModals — called when Escape is pressed (no args)
 */
export function initInteractions({ onStartStop, onCloseModals } = {}) {
  // Hover sound (desktop only)
  document.addEventListener('mouseover', (e) => {
    if (_suppressHover || _lastWasTouch) return;
    const el = e.target.closest(INTERACTIVE_SELECTOR);
    if (el && el !== _lastHoverEl) {
      playHoverClick();
      _lastHoverEl = el;
      _suppressHover = true;
      setTimeout(() => {
        _suppressHover = false;
      }, 150);
    }
  });

  document.addEventListener('mouseout', (e) => {
    const el = e.target.closest(INTERACTIVE_SELECTOR);
    if (el && !el.contains(e.relatedTarget)) _lastHoverEl = null;
  });

  // Touch: haptic only (avoids double-firing with the mouseover above)
  document.addEventListener(
    'touchstart',
    (e) => {
      _lastWasTouch = true;
      const el = e.target.closest(INTERACTIVE_SELECTOR);
      if (el && !el.disabled) navigator.vibrate?.(8);
    },
    { passive: true },
  );

  // Reset touch flag on real mouse movement
  document.addEventListener(
    'mousemove',
    () => {
      _lastWasTouch = false;
    },
    { passive: true },
  );

  // Click sound — mouse
  document.addEventListener('click', (e) => {
    if (_lastWasTouch) return;
    const el = e.target.closest(CLICK_SOUND_SELECTOR);
    if (el) {
      playHoverClick();
      suppressHoverBriefly(600);
    }
  });

  // Click sound — touch (via touchend to avoid double-firing with click)
  document.addEventListener(
    'touchend',
    (e) => {
      if (_lastWasTouch) return;
      const el = e.target.closest(CLICK_SOUND_SELECTOR);
      if (el && !el.disabled) {
        playHoverClick();
        _lastWasTouch = true;
        setTimeout(() => {
          _lastWasTouch = false;
        }, 600);
      }
    },
    { passive: true },
  );

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      onCloseModals?.();
      return;
    }
    if (e.key === ' ' || e.code === 'Space') {
      const modalOpen = document.querySelector('.modal-overlay.open');
      const focused = document.activeElement;
      const isInput =
        focused && ['INPUT', 'TEXTAREA', 'SELECT'].includes(focused.tagName);
      if (modalOpen || isInput) return;
      e.preventDefault();
      onStartStop?.();
    }
  });
}
