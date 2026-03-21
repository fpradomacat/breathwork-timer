// ── i18n ──────────────────────────────────────────────────────
const i18n = {
    es: {
        title:'Breathspace',
        statSession:'Sesión', statCycles:'Ciclos', statLast:'Última',
        inhale:'Inhala', holdFull:'Pausa (Lleno)', exhale:'Exhala', holdEmpty:'Pausa (Vacío)',
        vol:'Vol', start:'Iniciar', stop:'Detener', reset:'Reset',
        ready:'Listo', inhaling:'Inhala', holding:'Mantén', exhaling:'Exhala', waiting:'Espera',
        menuPresets:'🌬 Técnicas', menuSounds:'🔔 Sonidos', presetApply:'Aplicar',
        limitTitle:'Límite de sesión', limitNone:'Sin límite', limitMin:'Minutos', limitCyc:'Ciclos',
        soundPhases:['Inhalar','Pausa (Lleno)','Exhalar','Pausa (Vacío)'],
        limitMsg: (type,val) => type==='minutes' ? `⏱ ${val} min alcanzados` : `🔄 ${val} ciclos completados`,
        custom: 'Personalizado',
    },
    en: {
        title:'Breathspace',
        statSession:'Session', statCycles:'Cycles', statLast:'Last',
        inhale:'Inhale', holdFull:'Hold (Full)', exhale:'Exhale', holdEmpty:'Hold (Empty)',
        vol:'Vol', start:'Start', stop:'Stop', reset:'Reset',
        ready:'Ready', inhaling:'Inhale', holding:'Hold', exhaling:'Exhale', waiting:'Wait',
        menuPresets:'🌬 Techniques', menuSounds:'🔔 Sounds', presetApply:'Apply',
        limitTitle:'Session limit', limitNone:'No limit', limitMin:'Minutes', limitCyc:'Cycles',
        soundPhases:['Inhale','Hold (Full)','Exhale','Hold (Empty)'],
        limitMsg: (type,val) => type==='minutes' ? `⏱ ${val} min reached` : `🔄 ${val} cycles completed`,
        custom: 'Custom',
    }
};

let lang = 'es';

// ── DOM refs ──────────────────────────────────────────────────
const times = {
    inhale:    document.getElementById('time-inhale'),
    holdFull:  document.getElementById('time-hold-full'),
    exhale:    document.getElementById('time-exhale'),
    holdEmpty: document.getElementById('time-hold-empty'),
};
const breathText        = document.getElementById('breath-text');
const phaseTimerDisplay = document.getElementById('phase-timer');
const breathingCircle   = document.getElementById('breathing-circle');
const startBtn          = document.getElementById('start-btn');
const resetBtn          = document.getElementById('reset-btn');
const sessionCounter    = document.getElementById('session-counter');
const cycleCounter      = document.getElementById('cycle-counter');
const lastSession       = document.getElementById('last-session');
const techniqueLabel    = document.getElementById('technique-label');
const volSlider         = document.getElementById('volume-slider');

// ── Audio context ─────────────────────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function resumeAudio() { if (audioCtx.state === 'suspended') audioCtx.resume(); }
document.addEventListener('mousedown',  resumeAudio);
document.addEventListener('touchstart', resumeAudio, { passive: true });
document.addEventListener('keydown',    resumeAudio);

// ── Technique label ───────────────────────────────────────────
let activeTechniqueName = 'Box Breathing';

function setTechniqueLabel(name, isCustom = false) {
    if (!isCustom) activeTechniqueName = name;
    techniqueLabel.textContent = isCustom ? i18n[lang].custom : name;
    techniqueLabel.classList.toggle('is-custom', isCustom);
}

// ── UI sounds (all synthetic, Web Audio API) ──────────────────
function playTone(freq, duration, vol) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'sine'; osc.frequency.value = freq;
    const t = audioCtx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.02);
    gain.gain.linearRampToValueAtTime(0, t + duration);
    osc.start(t); osc.stop(t + duration + 0.05);
}

function playHoverClick() {
    const vol = parseFloat(volSlider.value);
    if (vol <= 0 || audioCtx.state === 'suspended') return;
    const len  = Math.floor(audioCtx.sampleRate * 0.012);
    const buf  = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++)
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.002));
    const src  = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    const hpf  = audioCtx.createBiquadFilter();
    hpf.type = 'highpass'; hpf.frequency.value = 2400;
    src.buffer = buf;
    src.connect(hpf); hpf.connect(gain); gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(vol * 0.18, audioCtx.currentTime);
    src.start();
}

function playStartSound() {
    const vol = parseFloat(volSlider.value);
    if (vol <= 0) return;
    [[440, 0], [554, 0.10]].forEach(([freq, delay]) => {
        const osc  = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sine'; osc.frequency.value = freq;
        const t = audioCtx.currentTime + delay;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol * 0.28, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        osc.start(t); osc.stop(t + 0.4);
    });
}

function playStopTone() {
    const vol = parseFloat(volSlider.value);
    if (vol <= 0) return;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, audioCtx.currentTime + 0.18);
    gain.gain.setValueAtTime(vol * 0.35, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.22);
    osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 0.25);
}

function playSelectChime() {
    const vol = parseFloat(volSlider.value) * 0.22;
    if (vol <= 0) return;
    [[520, 0], [660, 0.07], [800, 0.14]].forEach(([freq, delay]) => {
        const osc  = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sine'; osc.frequency.value = freq;
        const t = audioCtx.currentTime + delay;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
        osc.start(t); osc.stop(t + 0.4);
    });
}

function playVolumeTone() {
    clearTimeout(playVolumeTone._t);
    playVolumeTone._t = setTimeout(() => playTone(440, 0.35, parseFloat(volSlider.value) * 0.3), 80);
}
volSlider.addEventListener('input', playVolumeTone);

document.getElementById('gear-dropdown').addEventListener('wheel', e => {
    if (!e.target.classList.contains('gear-vol-slider')) return;
    e.preventDefault(); e.stopPropagation();
    volSlider.value = Math.min(1, Math.max(0, parseFloat((parseFloat(volSlider.value) + (e.deltaY < 0 ? 0.1 : -0.1)).toFixed(1))));
    playVolumeTone();
}, { passive: false });

// ── Hover click ───────────────────────────────────────────────
const HOVER_SELECTOR = [
    '#start-btn', '#reset-btn', '#lang-btn', '#gear-btn', '#session-gear-btn',
    '#open-presets', '.limit-chip', '.ctrl-option', '.input-group input',
    '.bmc-btn', '.author-tag', '.preset-card', '.modal-close',
].join(', ');

let _lastHoverEl = null;
let _suppressHover = false;

document.addEventListener('mouseover', e => {
    if (_suppressHover) return;
    const el = e.target.closest(HOVER_SELECTOR);
    if (el && el !== _lastHoverEl) { playHoverClick(); _lastHoverEl = el; }
});
document.addEventListener('mouseout', e => {
    const el = e.target.closest(HOVER_SELECTOR);
    if (el && !el.contains(e.relatedTarget)) _lastHoverEl = null;
});

// ── i18n ─────────────────────────────────────────────────────
function applyLang(l) {
    lang = l;
    const t = i18n[l];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (t[key] && typeof t[key] === 'string') el.textContent = t[key];
    });
    document.getElementById('lang-btn').textContent = l.toUpperCase();
    document.querySelectorAll('#lang-dropdown .ctrl-option').forEach(o =>
        o.classList.toggle('active', o.dataset.value === l));
    if (!isRunning) breathText.textContent = t.ready;
    startBtn.textContent = isRunning ? t.stop : t.start;
    const isCustom = techniqueLabel.classList.contains('is-custom');
    setTechniqueLabel(isCustom ? '' : activeTechniqueName, isCustom);
}

// ── Dropdowns ────────────────────────────────────────────────
const allDropdowns = ['lang-dropdown', 'gear-dropdown', 'session-gear-dropdown'];

function toggleDropdown(id) {
    const isOpen = document.getElementById(id).classList.contains('open');
    allDropdowns.forEach(d => document.getElementById(d).classList.remove('open'));
    if (!isOpen) document.getElementById(id).classList.add('open');
}

document.addEventListener('click', () =>
    allDropdowns.forEach(d => document.getElementById(d).classList.remove('open')));

['session-gear-dropdown', 'gear-dropdown'].forEach(id =>
    document.getElementById(id).addEventListener('click', e => e.stopPropagation()));

document.getElementById('lang-btn').addEventListener('click', e => {
    e.stopPropagation(); toggleDropdown('lang-dropdown');
});
document.querySelectorAll('#lang-dropdown .ctrl-option').forEach(o =>
    o.addEventListener('click', () => {
        applyLang(o.dataset.value);
        document.getElementById('lang-dropdown').classList.remove('open');
    }));

const controlsPanel = document.querySelector('.controls-panel');
function syncControlsPanelOverflow() {
    controlsPanel.classList.toggle('dropdown-open', document.getElementById('gear-dropdown').classList.contains('open'));
}
document.getElementById('gear-btn').addEventListener('click', e => {
    e.stopPropagation(); toggleDropdown('gear-dropdown'); syncControlsPanelOverflow();
});
document.addEventListener('click', syncControlsPanelOverflow);

document.getElementById('session-gear-btn').addEventListener('click', e => {
    e.stopPropagation(); toggleDropdown('session-gear-dropdown');
});

// ── Session limit ─────────────────────────────────────────────
let limitType  = 'none';
let limitValue = 10;
const limitInput = document.getElementById('limit-value');

document.querySelectorAll('.limit-chip').forEach(chip =>
    chip.addEventListener('click', () => {
        document.querySelectorAll('.limit-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        limitType = chip.dataset.value;
        limitInput.disabled = limitType === 'none';
    }));

limitInput.addEventListener('keydown', e => {
    if (['Backspace','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Delete'].includes(e.key)) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
});
limitInput.addEventListener('wheel', e => {
    e.preventDefault();
    limitInput.value = Math.max(1, (parseInt(limitInput.value) || 1) + (e.deltaY < 0 ? 1 : -1));
    limitValue = parseInt(limitInput.value);
}, { passive: false });
limitInput.addEventListener('blur', () => {
    const v = parseInt(limitInput.value);
    limitInput.value = (!v || v < 1) ? 1 : v;
    limitValue = parseInt(limitInput.value);
});
limitInput.addEventListener('input', () => { limitValue = parseInt(limitInput.value) || 1; });

function checkLimit() {
    if (limitType === 'none') return false;
    if (limitType === 'minutes' && totalSeconds >= limitValue * 60) return true;
    if (limitType === 'cycles'  && cycles >= limitValue) return true;
    return false;
}

// ── Presets ───────────────────────────────────────────────────
const PRESETS = [
    { nameEs:'Box Breathing',      nameEn:'Box Breathing',    timing:[4,4,4,4],
      descEs:'Equilibra el sistema nervioso. Usada por fuerzas especiales para mantener la calma bajo presión.',
      descEn:'Balances the nervous system. Used by special forces to stay calm under pressure.' },
    { nameEs:'4-7-8 Relajante',    nameEn:'4-7-8 Relaxing',   timing:[4,7,8,0],
      descEs:'Activa el sistema parasimpático. Ideal para reducir ansiedad y preparar el sueño.',
      descEn:'Activates the parasympathetic system. Ideal for reducing anxiety and preparing for sleep.' },
    { nameEs:'Wim Hof (ciclo)',     nameEn:'Wim Hof (cycle)',  timing:[2,0,2,0],
      descEs:'Hiperventilación controlada que eleva el oxígeno y genera energía. Hacé 30 ciclos rápidos.',
      descEn:'Controlled hyperventilation that raises oxygen and generates energy. Do 30 quick cycles.' },
    { nameEs:'Coherencia Cardíaca', nameEn:'Cardiac Coherence',timing:[5,0,5,0],
      descEs:'Sincroniza el ritmo cardíaco y el sistema nervioso. 5 minutos diarios tienen efecto acumulativo.',
      descEn:'Syncs heart rate and nervous system. 5 minutes daily has a cumulative effect.' },
    { nameEs:'Energizante',         nameEn:'Energizing',       timing:[6,0,2,0],
      descEs:'Inhala largo, exhala corto. Aumenta el nivel de activación y concentración.',
      descEn:'Long inhale, short exhale. Increases activation and concentration.' },
    { nameEs:'Relajación profunda', nameEn:'Deep Relaxation',  timing:[4,0,8,0],
      descEs:'Exhala el doble de lo que inhalas. Baja la frecuencia cardíaca y relaja el cuerpo.',
      descEn:'Exhale twice as long as you inhale. Lowers heart rate and relaxes the body.' },
    { nameEs:'Fire Breath',          nameEn:'Fire Breath',       timing:[1,0,1,0],
      descEs:'Respiración rápida y rítmica que activa el sistema nervioso y genera calor interno. Hacé 30–40 ciclos seguidos.',
      descEn:'Fast rhythmic breathing that activates the nervous system and generates internal heat. Do 30–40 consecutive cycles.' },
];

function renderPresets() {
    const list = document.getElementById('presets-list');
    list.innerHTML = '';
    PRESETS.forEach(p => {
        const [i, hf, e, he] = p.timing;
        const card = document.createElement('div');
        card.className = 'preset-card';
        card.innerHTML = `
            <div class="preset-header">
                <span class="preset-name">${lang === 'es' ? p.nameEs : p.nameEn}</span>
                <span class="preset-timing">${i}-${hf}-${e}-${he}</span>
            </div>
            <p class="preset-desc">${lang === 'es' ? p.descEs : p.descEn}</p>`;
        card.addEventListener('click', () => {
            times.inhale.value = i; times.holdFull.value = hf;
            times.exhale.value = e; times.holdEmpty.value = he;
            setTechniqueLabel(lang === 'es' ? p.nameEs : p.nameEn);
            playSelectChime();
            closeModal('modal-presets');
        });
        list.appendChild(card);
    });
}

// ── Phase sounds — decoded into AudioBuffers at load time ────
// Using AudioBufferSourceNode (Web Audio API) instead of HTMLAudioElement
// bypasses the OS audio stack entirely, eliminating Bluetooth dropouts.
const PHASE_SOUND_SRCS = [
    'assets/sounds/inhala.mp3',
    'assets/sounds/pausa_lleno.mp3',
    'assets/sounds/exhala.mp3',
    'assets/sounds/pausa_vacio.mp3',
];

const _phaseBuffers = new Array(PHASE_SOUND_SRCS.length).fill(null);

// Fetch + decode all files immediately. Runs in parallel.
// If a file fails (404, network error) the slot stays null and playPhase skips it silently.
PHASE_SOUND_SRCS.forEach((src, i) => {
    fetch(src)
        .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(ab => audioCtx.decodeAudioData(ab))
        .then(buf => { _phaseBuffers[i] = buf; })
        .catch(() => {});
});

function playPhase(pi) {
    const buf = _phaseBuffers[pi];
    if (!buf) return;
    const src  = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    src.buffer = buf;
    gain.gain.value = parseFloat(volSlider.value);
    src.connect(gain);
    gain.connect(audioCtx.destination);
    src.start();
}

document.getElementById('open-presets').addEventListener('click', () => {
    document.getElementById('gear-dropdown').classList.remove('open');
    renderPresets();
    openModal('modal-presets');
});

// ── Modals ────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-close').forEach(btn =>
    btn.addEventListener('click', () => closeModal(btn.dataset.close)));
document.querySelectorAll('.modal-overlay').forEach(el =>
    el.addEventListener('click', e => { if (e.target === el) closeModal(el.id); }));

// ── Toast ─────────────────────────────────────────────────────
const toastEl = document.createElement('div');
toastEl.className = 'limit-toast';
document.body.appendChild(toastEl);
let _toastTimer;
function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3500);
}

// ── Input wheels + touch drag ────────────────────────────────
// Desktop: scroll wheel. Mobile: hold + drag up/down.
// Every 8px of drag = ±1. Haptic feedback on each step if available.
Object.values(times).forEach(input => {
    // Desktop scroll
    input.addEventListener('wheel', e => {
        if (isRunning) return;
        e.preventDefault();
        let v = parseInt(input.value) || 0;
        v += e.deltaY < 0 ? 1 : -1;
        input.value = Math.max(parseInt(input.getAttribute('min')) || 0, v);
        setTechniqueLabel('', true);
    }, { passive: false });

    // Mobile touch drag
    let _touchStartY = null;
    let _touchBaseVal = null;
    let _lastStepVal = null;

    input.addEventListener('touchstart', e => {
        if (isRunning) return;
        _touchStartY  = e.touches[0].clientY;
        _touchBaseVal = parseInt(input.value) || 0;
        _lastStepVal  = _touchBaseVal;
        input.blur(); // hide keyboard immediately
    }, { passive: true });

    input.addEventListener('touchmove', e => {
        if (isRunning || _touchStartY === null) return;
        e.preventDefault(); // block page scroll while dragging
        const dy    = _touchStartY - e.touches[0].clientY; // up = positive
        const min   = parseInt(input.getAttribute('min')) || 0;
        const steps = Math.round(dy / 8);
        const next  = Math.max(min, _touchBaseVal + steps);
        if (next !== _lastStepVal) {
            input.value = next;
            _lastStepVal = next;
            setTechniqueLabel('', true);
            if (navigator.vibrate) navigator.vibrate(6);
        }
    }, { passive: false });

    input.addEventListener('touchend', () => {
        _touchStartY = null;
        _touchBaseVal = null;
        _lastStepVal = null;
    }, { passive: true });

    input.addEventListener('keydown', e => {
        if (['Backspace','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Delete'].includes(e.key)) return;
        if (!/^\d$/.test(e.key)) e.preventDefault();
    });
    input.addEventListener('input', () => setTechniqueLabel('', true));
    input.addEventListener('blur', () => {
        const min = parseInt(input.getAttribute('min')) || 0;
        const v   = parseInt(input.value);
        if (isNaN(v) || v < min) input.value = min;
    });
});

// ── Helpers ───────────────────────────────────────────────────
function toggleInputs(disabled) {
    Object.values(times).forEach(i => i.disabled = disabled);
    resetBtn.disabled = disabled;
    document.querySelector('.settings-grid').classList.toggle('locked', disabled);
}
function formatTime(s) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}
function setCircleState(state) {
    breathingCircle.classList.remove('idle', 'collapsed', 'active');
    if (state !== 'idle') breathingCircle.classList.add(state);
}

// ── Session state ─────────────────────────────────────────────
let isRunning      = false;
let cycles         = 0;
let totalSeconds   = 0;
let _sessionTimer  = null;   // setTimeout handle — ticks every 1 s
let _phaseTimer    = null;   // setTimeout handle — fires when phase ends
let _displayRAF    = null;   // rAF handle — only used for phase countdown display
let _keepAliveNode = null;   // silent oscillator — keeps AudioContext alive on Bluetooth

// ─────────────────────────────────────────────────────────────
// TIMING STRATEGY
//
// All critical timing (phase advances, session counter, limit checks)
// runs on plain setTimeout chains.  setTimeout keeps firing even when
// the browser tab is in the background or the screen is off — unlike
// requestAnimationFrame, which is paused by every mobile browser.
//
// rAF is used only for the phase countdown number inside the circle
// (purely cosmetic).  If it pauses, the number just stops updating;
// the phase still ends at the right time because _phaseTimer fires.
// ─────────────────────────────────────────────────────────────

// Session clock — fires every 1 000 ms, increments totalSeconds
function _sessionTick() {
    if (!isRunning) return;
    totalSeconds++;
    sessionCounter.innerText = formatTime(totalSeconds);
    if (limitType === 'minutes' && checkLimit()) {
        stopTimer(i18n[lang].limitMsg(limitType, limitValue));
        return;
    }
    _sessionTimer = setTimeout(_sessionTick, 1000);
}

// Phase countdown display — rAF loop, purely visual
// phaseEndsAt is a performance.now() timestamp
let _phaseEndsAt = 0;
function _displayTick() {
    if (!isRunning) return;
    const rem = Math.ceil((_phaseEndsAt - performance.now()) / 1000);
    phaseTimerDisplay.innerText = rem > 0 ? rem : '';
    _displayRAF = requestAnimationFrame(_displayTick);
}

// Wait `seconds` then call `cb`. Stores handle in _phaseTimer so it
// can be cancelled cleanly. Also kicks off the display loop.
function waitPhase(seconds, cb) {
    clearTimeout(_phaseTimer);
    cancelAnimationFrame(_displayRAF);
    _phaseEndsAt = performance.now() + seconds * 1000;
    _phaseTimer  = setTimeout(cb, seconds * 1000);
    _displayRAF  = requestAnimationFrame(_displayTick);
}

// ── Flow ──────────────────────────────────────────────────────
// Flat callback chain — no async/await, no Promises.
// Each phase calls the next one directly via waitPhase().
function runCycle() {
    if (!isRunning) return;

    const t    = i18n[lang];
    const tIn  = parseInt(times.inhale.value)    || 0;
    const tHF  = parseInt(times.holdFull.value)  || 0;
    const tOut = parseInt(times.exhale.value)    || 0;
    const tHE  = parseInt(times.holdEmpty.value) || 0;

    // Build phase list — skip any with duration 0
    const phases = [];
    if (tIn  > 0) phases.push({ dur: tIn,  label: t.inhaling, state: 'active',    sound: 0,
        transition: `transform ${tIn}s cubic-bezier(.4,0,.2,1),opacity ${tIn}s cubic-bezier(.4,0,.2,1),box-shadow ${tIn}s cubic-bezier(.4,0,.2,1)` });
    if (tHF  > 0) phases.push({ dur: tHF,  label: t.holding,  state: null,         sound: 1, transition: null });
    if (tOut > 0) phases.push({ dur: tOut, label: t.exhaling, state: 'collapsed',  sound: 2,
        transition: `transform ${tOut}s cubic-bezier(.4,0,.2,1),opacity ${tOut}s cubic-bezier(.4,0,.2,1),box-shadow ${tOut}s cubic-bezier(.4,0,.2,1)` });
    if (tHE  > 0) phases.push({ dur: tHE,  label: t.waiting,  state: null,         sound: 3, transition: null });

    if (phases.length === 0) return;

    let idx = 0;

    function nextPhase() {
        if (!isRunning) return;

        if (idx >= phases.length) {
            // Cycle complete
            cycles++;
            cycleCounter.innerText = cycles;
            if (checkLimit()) {
                stopTimer(i18n[lang].limitMsg(limitType, limitValue));
                return;
            }
            idx = 0; // restart cycle
        }

        const phase = phases[idx++];
        breathText.innerText = phase.label;
        if (phase.transition) breathingCircle.style.transition = phase.transition;
        if (phase.state)      setCircleState(phase.state);
        playPhase(phase.sound);
        waitPhase(phase.dur, nextPhase);
    }

    nextPhase();
}

// ── Start / Stop ──────────────────────────────────────────────
const TRANSITION_MS = 1200;

function startTimer() {
    resumeAudio();
    playStartSound();
    _suppressHover = true;
    startBtn.blur();
    toggleInputs(true);
    startBtn.disabled = true;
    breathText.innerText = '';
    phaseTimerDisplay.innerText = '';
    breathingCircle.style.transition = '';
    setCircleState('collapsed');
    document.querySelector('.container').classList.add('session');

    setTimeout(() => {
        isRunning    = true;
        totalSeconds = 0;
        cycles       = 0;
        startBtn.disabled     = false;
        startBtn.innerText    = i18n[lang].stop;
        startBtn.style.background   = 'linear-gradient(135deg,rgba(220,60,80,.6),rgba(180,30,50,.5))';
        startBtn.style.borderColor  = 'rgba(220,100,100,.3)';
        sessionCounter.innerText = '00:00';
        cycleCounter.innerText   = '0';

        // Start session clock
        _sessionTimer = setTimeout(_sessionTick, 1000);

        // Keep AudioContext alive for the whole session.
        // Without this, mobile browsers (especially with Bluetooth) suspend
        // the context during silent gaps, causing audible dropouts on resume.
        _keepAliveNode = audioCtx.createOscillator();
        const _kaGain  = audioCtx.createGain();
        _kaGain.gain.value = 0;   // completely silent
        _keepAliveNode.connect(_kaGain);
        _kaGain.connect(audioCtx.destination);
        _keepAliveNode.start();

        // Start breathing flow
        runCycle();

        setTimeout(() => { _suppressHover = false; _lastHoverEl = null; }, 100);
    }, TRANSITION_MS);
}

function stopTimer(limitMsg) {
    isRunning = false;

    // Cancel all timers
    clearTimeout(_sessionTimer);
    clearTimeout(_phaseTimer);
    cancelAnimationFrame(_displayRAF);
    _sessionTimer = null;
    _phaseTimer   = null;
    _displayRAF   = null;

    // Stop the keep-alive oscillator
    if (_keepAliveNode) { try { _keepAliveNode.stop(); } catch(e) {} _keepAliveNode = null; }

    lastSession.innerText = `${formatTime(totalSeconds)} (${cycles})`;
    playStopTone();
    if (limitMsg) showToast(limitMsg);

    toggleInputs(true);
    startBtn.disabled    = true;
    startBtn.innerText   = i18n[lang].start;
    startBtn.style.background  = '';
    startBtn.style.borderColor = '';
    phaseTimerDisplay.innerText = '';
    breathText.innerText        = '';
    breathingCircle.style.transition = '';
    setCircleState('idle');
    document.querySelector('.container').classList.remove('session');

    setTimeout(() => {
        breathText.innerText = i18n[lang].ready;
        toggleInputs(false);
        startBtn.disabled = false;
    }, TRANSITION_MS);
}

startBtn.onclick = () => isRunning ? stopTimer() : startTimer();
resetBtn.onclick = () => {
    if (isRunning) return;
    renderPresets();
    openModal('modal-presets');
};

// Prevent browser session-restore from showing stale input values
window.addEventListener('load', () => {
    times.inhale.value = 4; times.holdFull.value = 4;
    times.exhale.value = 4; times.holdEmpty.value = 4;
    setTechniqueLabel('Box Breathing');
});