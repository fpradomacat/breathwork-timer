// ── Breathing tests (modal) ───────────────────────────────────
//
// The tests and their results live in breath-test-data.js. The modal
// has four views, rendered into #tests-body:
//   list → detail (instructions + your results) → running → result

import { i18n } from './i18n.js';
import { lang, presetText, openModal } from './ui.js';
import { TESTS, bandIndex, addResult, resultsOf } from './breath-test-data.js';

// ── View helpers ──────────────────────────────────────────────
const _body = () => document.getElementById('tests-body');
const _fmt = (secs) => `${secs.toFixed(1).replace(/\.0$/, '')} s`;
const _bandLabel = (test, secs) =>
  test.bands[bandIndex(test, secs)][lang === 'es' ? 1 : 2];

let _timer = null;
function _stopTimer() {
  clearInterval(_timer);
  _timer = null;
}

function _renderList() {
  _stopTimer();
  const t = i18n[lang];
  _body().innerHTML = `
    <p class="tests-intro">${t.testsIntro}</p>
    ${TESTS.map((test) => {
      const [last] = resultsOf(test.id);
      return `<button class="test-card" data-test="${test.id}">
        <span class="test-card-head">
          <span class="test-card-name"><span aria-hidden="true">${test.emoji}</span> ${presetText(test, 'name')}</span>
          <span class="test-card-last">${last ? _fmt(last.secs) : ''}</span>
        </span>
        <span class="test-card-desc">${presetText(test, 'desc')}</span>
      </button>`;
    }).join('')}
    <p class="tests-safety"><span aria-hidden="true">⚠️</span> ${t.testsSafety}</p>`;
  _body()
    .querySelectorAll('.test-card')
    .forEach((card) =>
      card.addEventListener('click', () =>
        _renderDetail(TESTS.find((x) => x.id === card.dataset.test)),
      ),
    );
}

function _resultsHtml(test) {
  const t = i18n[lang];
  const results = resultsOf(test.id);
  if (!results.length) return `<p class="test-none">${t.testNone}</p>`;
  const best = Math.max(...results.map((r) => r.secs));
  const date = new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'short',
  });
  return `
    <p class="test-best">${t.testBest(_fmt(best))}</p>
    <ul class="test-results">${results
      .slice(0, 5)
      .map(
        (r) =>
          `<li><span>${date.format(new Date(r.date))}</span><span>${_bandLabel(test, r.secs)}</span><span class="test-results-secs">${_fmt(r.secs)}</span></li>`,
      )
      .join('')}</ul>`;
}

function _renderDetail(test) {
  _stopTimer();
  const t = i18n[lang];
  _body().innerHTML = `
    <p class="test-title"><span aria-hidden="true">${test.emoji}</span> ${presetText(test, 'name')}</p>
    <ol class="test-steps">${presetText(test, 'steps')
      .map((s) => `<li>${s}</li>`)
      .join('')}</ol>
    <button class="btn btn-primary test-primary" id="test-start">${t.testStart}</button>
    <p class="test-ref">${presetText(test, 'ref')}</p>
    <p class="history-subtitle">${t.testHistory}</p>
    ${_resultsHtml(test)}
    <button class="test-link" id="test-back">← ${t.testBack}</button>`;
  document
    .getElementById('test-start')
    .addEventListener('click', () => _renderRunning(test));
  document.getElementById('test-back').addEventListener('click', _renderList);
  document.getElementById('test-start').focus({ preventScroll: true });
}

function _renderRunning(test) {
  const t = i18n[lang];
  _body().innerHTML = `
    <p class="test-running-hint">${presetText(test, 'running')}</p>
    <button class="test-stop" id="test-stop">
      <span class="test-clock" id="test-clock">0</span>
      <span class="test-stop-label">${t.testDone}</span>
    </button>
    <button class="test-link" id="test-cancel">${t.testCancel}</button>`;

  const started = performance.now();
  const clock = document.getElementById('test-clock');
  const elapsed = () => (performance.now() - started) / 1000;
  _timer = setInterval(() => {
    // The modal was closed mid-test: drop it
    if (!document.getElementById('modal-tests').classList.contains('open')) {
      _stopTimer();
      return;
    }
    clock.textContent = Math.floor(elapsed());
  }, 100);

  document.getElementById('test-stop').addEventListener('click', () => {
    const secs = Math.round(elapsed() * 10) / 10;
    _stopTimer();
    _renderResult(test, secs);
  });
  document
    .getElementById('test-cancel')
    .addEventListener('click', () => _renderDetail(test));
  document.getElementById('test-stop').focus({ preventScroll: true });
}

function _renderResult(test, secs) {
  const t = i18n[lang];
  const previous = resultsOf(test.id);
  const best = previous.length ? Math.max(...previous.map((r) => r.secs)) : 0;
  addResult(test.id, secs);

  const band = bandIndex(test, secs);
  let note = '';
  if (previous.length && secs > best) note = t.testNewBest;
  else if (previous.length)
    note = t.testDiff(Math.round((secs - previous[0].secs) * 10) / 10);

  _body().innerHTML = `
    <div class="test-result">
      <span class="test-result-secs">${_fmt(secs)}</span>
      <span class="test-band test-band-${band}">${_bandLabel(test, secs)}</span>
      ${note ? `<p class="test-note">${note}</p>` : ''}
      <p class="test-ref">${presetText(test, 'ref')}</p>
    </div>
    <button class="btn btn-primary test-primary" id="test-again">${t.testAgain}</button>
    <button class="test-link" id="test-back">← ${t.testBack}</button>`;
  document
    .getElementById('test-again')
    .addEventListener('click', () => _renderDetail(test));
  document.getElementById('test-back').addEventListener('click', _renderList);
}

/** Open the tests modal on its list view. */
export function openTests() {
  _renderList();
  openModal('modal-tests');
}

/** Re-render after a language change (back to the list if it's open). */
export function refreshTestsLang() {
  if (document.getElementById('modal-tests').classList.contains('open'))
    _renderList();
}
