// ── theme.js — Temas, háptica, arco SVG ───────────────────────

// ── Temas ─────────────────────────────────────────────────────
const THEMES = [
    { id: 'purple', label: '✦ Púrpura' },
    { id: 'midnight', label: '◆ Midnight' },
    { id: 'aurora', label: '◎ Aurora' },
    { id: 'sand', label: '○ Arena' },
];

let activeTheme = localStorage.getItem('bs-theme') || 'purple';

function applyTheme(id) {
    activeTheme = id;
    document.documentElement.setAttribute('data-theme', id);
    localStorage.setItem('bs-theme', id);
    document.querySelectorAll('.theme-chip').forEach(c =>
        c.classList.toggle('active', c.dataset.theme === id));
}

// ── Render theme chips in modal ────────────────────────────────
function renderThemeChips() {
    const wrap = document.getElementById('theme-chips');
    if (!wrap) return;
    wrap.innerHTML = '';
    THEMES.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'theme-chip' + (t.id === activeTheme ? ' active' : '');
        btn.dataset.theme = t.id;
        btn.textContent = t.label;
        btn.addEventListener('click', () => applyTheme(t.id));
        wrap.appendChild(btn);
    });
}

// ── Arco SVG ───────────────────────────────────────────────────
// El arco rodea el breathing-circle. Se actualiza cada rAF.
let _arcSVG = null;
let _arcCircle = null;
let _arcLen = 0;

function initArc() {
    if (_arcSVG) return;
    const container = document.getElementById('breathing-circle-container');

    // Bolita expandida = 220px × scale(1.35) = 297px → radio = ~148px
    // SVG fijo de 300×300, centrado en el container, no dentro de la bolita
    const SIZE = 300;
    const CX = 150, CY = 150, R = 148;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'phase-arc';
    svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
    svg.style.cssText = `
        position:absolute;
        width:${SIZE}px; height:${SIZE}px;
        top:50%; left:50%;
        transform:translate(-50%,-50%);
        pointer-events:none;
        opacity:0;
        transition:opacity .5s ease;
        overflow:visible;
        z-index:0;
    `;

    _arcLen = 2 * Math.PI * R;

    const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    track.setAttribute('cx', CX); track.setAttribute('cy', CY); track.setAttribute('r', R);
    track.setAttribute('fill', 'none');
    track.setAttribute('stroke', 'var(--arc-track)');
    track.setAttribute('stroke-width', '1');
    track.setAttribute('stroke-dasharray', '2 10');
    track.setAttribute('stroke-linecap', 'round');

    const arc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    arc.setAttribute('cx', CX); arc.setAttribute('cy', CY); arc.setAttribute('r', R);
    arc.setAttribute('fill', 'none');
    arc.setAttribute('stroke', 'var(--arc-color)');
    arc.setAttribute('stroke-width', '1.5');
    arc.setAttribute('stroke-linecap', 'round');
    arc.style.transformOrigin = `${CX}px ${CY}px`;
    arc.style.transform = 'rotate(-90deg)';
    arc.setAttribute('stroke-dasharray', _arcLen);
    arc.setAttribute('stroke-dashoffset', _arcLen);

    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', CX); dot.setAttribute('cy', CY - R);
    dot.setAttribute('r', '2.5');
    dot.setAttribute('fill', 'var(--arc-color)');
    dot.style.opacity = '0';
    dot.id = 'arc-dot';

    svg.appendChild(track);
    svg.appendChild(arc);
    svg.appendChild(dot);

    container.style.position = 'relative';
    container.appendChild(svg);

    _arcSVG = svg; _arcCircle = arc; _arcDot = dot;
    _arcR = R; _arcCX = CX; _arcCY = CY;
}

let _arcDot = null;
let _arcR   = 148;
let _arcCX  = 110;
let _arcCY  = 110;

// progress: 0 (empty) → 1 (full)
function setArc(progress) {
    if (!_arcCircle) return;
    const p = Math.max(0, Math.min(1, progress));
    const offset = _arcLen * (1 - p);
    _arcCircle.setAttribute('stroke-dashoffset', offset);
    // Move dot along the arc
    if (_arcDot) {
        const angle = (p * 2 * Math.PI) - (Math.PI / 2);
        const dx = _arcCX + _arcR * Math.cos(angle);
        const dy = _arcCY + _arcR * Math.sin(angle);
        _arcDot.setAttribute('cx', dx);
        _arcDot.setAttribute('cy', dy);
        _arcDot.style.opacity = p > 0.01 ? '0.8' : '0';
    }
}

function showArc(visible) {
    if (!_arcSVG) return;
    _arcSVG.style.opacity = visible ? '1' : '0';
}

// ── rAF loop for arc (driven by phase timing) ──────────────────
let _arcRAF      = null;
let _arcStart    = 0;
let _arcDuration = 0;
let _arcReverse  = false; // true = exhale (full→empty)

function startArcPhase(durationSec, reverse) {
    cancelAnimationFrame(_arcRAF);
    _arcStart    = performance.now();
    _arcDuration = durationSec * 1000;
    _arcReverse  = reverse;
    showArc(true);
    _tickArc();
}

function _tickArc() {
    const elapsed  = performance.now() - _arcStart;
    const progress = Math.min(elapsed / _arcDuration, 1);
    setArc(_arcReverse ? 1 - progress : progress);
    if (progress < 1) _arcRAF = requestAnimationFrame(_tickArc);
}

function stopArc() {
    cancelAnimationFrame(_arcRAF);
    showArc(false);
}

// ── Patch waitPhase to drive arc ─────────────────────────────
const _origWaitPhase = waitPhase;
waitPhase = function(seconds, cb) {
    const label = (document.getElementById('breath-text').innerText || '').toLowerCase();
    const isHold = ['mantén','hold','espera','wait'].includes(label);
    if (isHold) {
        showArc(true);
    } else {
        const isExhale = label === 'exhala' || label === 'exhale';
        startArcPhase(seconds, isExhale);
    }
    _origWaitPhase(seconds, cb);
};

// ── Patch stopTimer to hide arc ───────────────────────────────
const _origStopTimer = stopTimer;
stopTimer = function(...args) {
    stopArc();
    _origStopTimer(...args);
};

// ── Háptica ───────────────────────────────────────────────────
function haptic(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
}

// ── Patch playPhase to add haptics ────────────────────────────
const _origPlayPhase = playPhase;
playPhase = function(pi) {
    if      (pi === 0) haptic(40);
    else if (pi === 1) haptic([20, 40, 20]);
    else if (pi === 2) haptic(60);
    else if (pi === 3) haptic([15, 30, 15]);
    _origPlayPhase(pi);
};

// ── Init ──────────────────────────────────────────────────────
initArc();
applyTheme(activeTheme);
renderThemeChips();