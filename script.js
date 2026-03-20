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
        tickOn: 'Tic-tac: On', tickOff: 'Tic-tac: Off',
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
        tickOn: 'Tick-tock: On', tickOff: 'Tick-tock: Off',
    }
};

let lang = 'es';

// ── DOM refs ──────────────────────────────────────────────────
const times = {
    inhale:   document.getElementById('time-inhale'),
    holdFull: document.getElementById('time-hold-full'),
    exhale:   document.getElementById('time-exhale'),
    holdEmpty:document.getElementById('time-hold-empty'),
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
// IMPORTANT: AudioContext must be created INSIDE a user-gesture handler.
// The browser blocks any audio until a click/keydown/touchstart has occurred.
// Hovering is NOT a user gesture, so we cannot create or resume the context on hover.
// Solution: create it lazily on the first real gesture, then it stays alive forever.
let audioCtx = null;

function _ensureAudioCtx() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Also build the tick buffers now that the context exists
    tickBufs[0] = _makeTickBuf(0);
    tickBufs[1] = _makeTickBuf(1);
}
document.addEventListener('mousedown',  _ensureAudioCtx);
document.addEventListener('touchstart', _ensureAudioCtx, { passive: true });
document.addEventListener('keydown',    _ensureAudioCtx);

// ── Clock tick — fully synthetic, no files, no CORS ──────────
let tickEnabled = true;
let tickBeat = 0;
let tickNextTime = 0;
let tickRAF = null;

// Generates a synthetic clock-tick buffer: shaped noise burst ~22ms
// beatType 0 = main beat, 1 = mid beat (softer)
function _makeTickBuf(beatType) {
    const sampleRate = audioCtx.sampleRate;
    const len = Math.floor(sampleRate * 0.022);
    const buf = audioCtx.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
        // Slower decay = less harsh transient
        const env = Math.exp(-i / (sampleRate * (beatType === 0 ? 0.008 : 0.011)));
        data[i] = (Math.random() * 2 - 1) * env;
    }
    return buf;
}

// Filled inside _ensureAudioCtx() after the context is created
const tickBufs = [null, null];

function scheduleTickAt(beatType, when, vol) {
    const src  = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    // Lower HPF cutoff = warmer, less strident click
    const hpf  = audioCtx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = beatType === 0 ? 800 : 600;
    // Low-pass to roll off harsh highs
    const lpf  = audioCtx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 4000;
    src.buffer = tickBufs[beatType];
    src.connect(hpf); hpf.connect(lpf); lpf.connect(gain); gain.connect(audioCtx.destination);
    const amplitude = vol * (beatType === 0 ? 0.30 : 0.18);
    gain.gain.setValueAtTime(amplitude, when);
    src.start(when);
}

function tickLoop() {
    const vol = parseFloat(volSlider.value);
    const LOOKAHEAD = 0.15;
    while (tickNextTime < audioCtx.currentTime + LOOKAHEAD) {
        if (tickEnabled && vol > 0) {
            scheduleTickAt(tickBeat % 2, tickNextTime, vol);
        }
        tickBeat++;
        tickNextTime += 1.0;
    }
    tickRAF = requestAnimationFrame(tickLoop);
}

function startTick() {
    cancelAnimationFrame(tickRAF);
    tickBeat = 0;
    tickNextTime = audioCtx.currentTime + 0.05;
    tickRAF = requestAnimationFrame(tickLoop);
}

function stopTick() {
    cancelAnimationFrame(tickRAF);
    tickRAF = null;
}

let isRunning=false, currentPhaseTimeout=null, timerInterval=null, phaseInterval=null;
let totalSeconds=0, cycles=0;

// ── Technique label ───────────────────────────────────────────
let activeTechniqueName = 'Box Breathing';

function setTechniqueLabel(name, isCustom = false) {
    if (!isCustom) activeTechniqueName = name;
    techniqueLabel.textContent = isCustom ? i18n[lang].custom : name;
    techniqueLabel.classList.toggle('is-custom', isCustom);
}

// ── UI sounds (all synthetic) ─────────────────────────────────
function playTone(freq, duration, vol) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'sine'; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
    osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + duration + 0.05);
}

// Hover: tiny noise click — same technique as tick but shorter & quieter
function playHoverClick() {
    if (!audioCtx) return;   // not yet created — need a click first
    const vol = parseFloat(volSlider.value);
    if (vol <= 0) return;
    const len = Math.floor(audioCtx.sampleRate * 0.012);
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random()*2-1) * Math.exp(-i/(audioCtx.sampleRate*0.002));
    const src  = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    const hpf  = audioCtx.createBiquadFilter();
    hpf.type = 'highpass'; hpf.frequency.value = 2400;
    src.buffer = buf;
    src.connect(hpf); hpf.connect(gain); gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(vol * 0.18, audioCtx.currentTime);
    src.start();
}

// Start: two warm ascending tones — soft, inviting
function playStartSound() {
    if (!audioCtx) return;
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

// Stop: single soft descending thud — short, neutral
function playStopTone() {
    if (!audioCtx) return;
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
    if (!audioCtx) return;
    const vol = parseFloat(volSlider.value) * 0.22;
    if (vol <= 0) return;
    [[520, 0], [660, 0.07], [800, 0.14]].forEach(([freq, delay]) => {
        const osc = audioCtx.createOscillator();
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
    let v = parseFloat(volSlider.value) + (e.deltaY < 0 ? 0.1 : -0.1);
    volSlider.value = Math.min(1, Math.max(0, parseFloat(v.toFixed(1))));
    playVolumeTone();
}, { passive: false });

// Hover click — all interactive elements on main screen + modals
// Uses mouseover+mouseout tracking to fire only on enter, not on child re-bubbles
const HOVER_SELECTOR = [
    // main screen
    '#start-btn', '#reset-btn', '#lang-btn', '#gear-btn', '#session-gear-btn',
    '#toggle-tick', '#open-presets',
    '.limit-chip', '.ctrl-option', '.input-group input',
    // footer
    '.bmc-btn', '.author-tag',
    // modals
    '.preset-card', '.modal-close',
].join(', ');
let _lastHoverEl = null;
document.addEventListener('mouseover', e => {
    const el = e.target.closest(HOVER_SELECTOR);
    if (el && el !== _lastHoverEl) { playHoverClick(); _lastHoverEl = el; }
});
document.addEventListener('mouseout', e => {
    const el = e.target.closest(HOVER_SELECTOR);
    if (el && !el.contains(e.relatedTarget)) _lastHoverEl = null;
});

// ── i18n apply ────────────────────────────────────────────────
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
    document.getElementById('tick-label').textContent = tickEnabled ? t.tickOn : t.tickOff;
}

// ── Dropdown helper ───────────────────────────────────────────
const allDropdowns = ['lang-dropdown','gear-dropdown','session-gear-dropdown'];

function toggleDropdown(id) {
    const isOpen = document.getElementById(id).classList.contains('open');
    allDropdowns.forEach(d => document.getElementById(d).classList.remove('open'));
    if (!isOpen) document.getElementById(id).classList.add('open');
}

document.addEventListener('click', () =>
    allDropdowns.forEach(d => document.getElementById(d).classList.remove('open')));

['session-gear-dropdown','gear-dropdown'].forEach(id =>
    document.getElementById(id).addEventListener('click', e => e.stopPropagation()));

document.getElementById('lang-btn').addEventListener('click', e => { e.stopPropagation(); toggleDropdown('lang-dropdown'); });
document.querySelectorAll('#lang-dropdown .ctrl-option').forEach(o =>
    o.addEventListener('click', () => { applyLang(o.dataset.value); document.getElementById('lang-dropdown').classList.remove('open'); }));

const controlsPanel = document.querySelector('.controls-panel');
function syncControlsPanelOverflow() {
    const gearOpen = document.getElementById('gear-dropdown').classList.contains('open');
    controlsPanel.classList.toggle('dropdown-open', gearOpen);
}
document.getElementById('gear-btn').addEventListener('click', e => {
    e.stopPropagation(); toggleDropdown('gear-dropdown'); syncControlsPanelOverflow();
});
document.addEventListener('click', syncControlsPanelOverflow);

document.getElementById('session-gear-btn').addEventListener('click', e => {
    e.stopPropagation(); toggleDropdown('session-gear-dropdown');
});

// ── Session limit ─────────────────────────────────────────────
let limitType = 'none';
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
    let v = parseInt(limitInput.value) || 1;
    v += e.deltaY < 0 ? 1 : -1;
    limitInput.value = Math.max(1, v);
    limitValue = parseInt(limitInput.value);
}, { passive: false });
limitInput.addEventListener('blur', () => {
    const v = parseInt(limitInput.value);
    limitInput.value = (!v || v < 1) ? 1 : v;
    limitValue = parseInt(limitInput.value);
});
limitInput.addEventListener('input', () => limitValue = parseInt(limitInput.value) || 1);

function checkLimit() {
    if (limitType === 'none') return false;
    if (limitType === 'minutes' && totalSeconds >= limitValue * 60) return true;
    if (limitType === 'cycles'  && cycles >= limitValue) return true;
    return false;
}

// ── Presets ───────────────────────────────────────────────────
const PRESETS = [
    { nameEs:'Box Breathing',       nameEn:'Box Breathing',    timing:[4,4,4,4],
      descEs:'Equilibra el sistema nervioso. Usada por fuerzas especiales para mantener la calma bajo presión.',
      descEn:'Balances the nervous system. Used by special forces to stay calm under pressure.' },
    { nameEs:'4-7-8 Relajante',     nameEn:'4-7-8 Relaxing',   timing:[4,7,8,0],
      descEs:'Activa el sistema parasimpático. Ideal para reducir ansiedad y preparar el sueño.',
      descEn:'Activates the parasympathetic system. Ideal for reducing anxiety and preparing for sleep.' },
    { nameEs:'Wim Hof (ciclo)',      nameEn:'Wim Hof (cycle)',  timing:[2,0,2,0],
      descEs:'Hiperventilación controlada que eleva el oxígeno y genera energía. Hacé 30 ciclos rápidos.',
      descEn:'Controlled hyperventilation that raises oxygen and generates energy. Do 30 quick cycles.' },
    { nameEs:'Coherencia Cardíaca',  nameEn:'Cardiac Coherence',timing:[5,0,5,0],
      descEs:'Sincroniza el ritmo cardíaco y el sistema nervioso. 5 minutos diarios tienen efecto acumulativo.',
      descEn:'Syncs heart rate and nervous system. 5 minutes daily has a cumulative effect.' },
    { nameEs:'Energizante',          nameEn:'Energizing',       timing:[6,0,2,0],
      descEs:'Inhala largo, exhala corto. Aumenta el nivel de activación y concentración.',
      descEn:'Long inhale, short exhale. Increases activation and concentration.' },
    { nameEs:'Relajación profunda',  nameEn:'Deep Relaxation',  timing:[4,0,8,0],
      descEs:'Exhala el doble de lo que inhalas. Baja la frecuencia cardíaca y relaja el cuerpo.',
      descEn:'Exhale twice as long as you inhale. Lowers heart rate and relaxes the body.' },
];

function renderPresets() {
    const list = document.getElementById('presets-list');
    list.innerHTML = '';
    PRESETS.forEach(p => {
        const [i,hf,e,he] = p.timing;
        const card = document.createElement('div');
        card.className = 'preset-card';
        card.innerHTML = `
            <div class="preset-header">
                <span class="preset-name">${lang==='es'?p.nameEs:p.nameEn}</span>
                <span class="preset-timing">${i}-${hf}-${e}-${he}</span>
            </div>
            <p class="preset-desc">${lang==='es'?p.descEs:p.descEn}</p>`;
        card.addEventListener('click', () => {
            times.inhale.value=i; times.holdFull.value=hf;
            times.exhale.value=e; times.holdEmpty.value=he;
            setTechniqueLabel(lang==='es'?p.nameEs:p.nameEn);
            playSelectChime();
            closeModal('modal-presets');
        });
        list.appendChild(card);
    });
}

// ── Phase sounds (hardcoded per phase) ────────────────────────
const PHASE_SOUNDS = [
    'assets/sounds/inhala.mp3',      // 0 inhale
    'assets/sounds/pausa_lleno.mp3', // 1 hold full
    'assets/sounds/exhala.mp3',      // 2 exhale
    'assets/sounds/pausa_vacio.mp3', // 3 hold empty
];

document.getElementById('open-presets').addEventListener('click', () => {
    document.getElementById('gear-dropdown').classList.remove('open');
    renderPresets(); openModal('modal-presets');
});

document.getElementById('toggle-tick').addEventListener('click', () => {
    tickEnabled = !tickEnabled;
    document.getElementById('tick-label').textContent = tickEnabled
        ? i18n[lang].tickOn
        : i18n[lang].tickOff;
    document.getElementById('toggle-tick').classList.toggle('muted', !tickEnabled);
});

// ── Modal helpers ─────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-close').forEach(btn =>
    btn.addEventListener('click', () => closeModal(btn.dataset.close)));
document.querySelectorAll('.modal-overlay').forEach(el =>
    el.addEventListener('click', e => { if(e.target===el) closeModal(el.id); }));

// ── Toast ─────────────────────────────────────────────────────
const toastEl = document.createElement('div');
toastEl.className = 'limit-toast';
document.body.appendChild(toastEl);
let toastTimer;
function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3500);
}

// ── Phase audio ───────────────────────────────────────────────
function playPhase(pi) {
    const file = PHASE_SOUNDS[pi];
    if (!file) return;
    // Push the next tick past this moment — skips the beat that coincides with the phase sound.
    // tickNextTime may already be slightly ahead (lookahead), so only nudge if it's within 0.3s.
    if (tickNextTime - audioCtx.currentTime < 0.3) {
        tickNextTime = audioCtx.currentTime + 0.3;
    }
    const a = new Audio(file);
    a.volume = parseFloat(volSlider.value);
    a.play().catch(() => {});
}

// ── Input wheels + custom label ───────────────────────────────
Object.values(times).forEach(input => {
    input.addEventListener('wheel', e => {
        if (isRunning) return;
        e.preventDefault();
        let v = parseInt(input.value)||0;
        v += e.deltaY < 0 ? 1 : -1;
        input.value = Math.max(parseInt(input.getAttribute('min'))||0, v);
        setTechniqueLabel('', true);
    }, { passive: false });
    input.addEventListener('keydown', e => {
        if (['Backspace','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Delete'].includes(e.key)) return;
        if (!/^\d$/.test(e.key)) e.preventDefault();
    });
    input.addEventListener('input', () => setTechniqueLabel('', true));
    input.addEventListener('blur', () => {
        const min=parseInt(input.getAttribute('min'))||0, v=parseInt(input.value);
        if (isNaN(v)||v<min) input.value=min;
    });
});

// ── Helpers ───────────────────────────────────────────────────
function toggleInputs(disabled) {
    Object.values(times).forEach(i => i.disabled=disabled);
    resetBtn.disabled=disabled;
    document.querySelector('.settings-grid').classList.toggle('locked',disabled);
}
function formatTime(s) {
    return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
}
function startPhaseCountdown(seconds) {
    clearInterval(phaseInterval);
    let rem=seconds; phaseTimerDisplay.innerText=rem;
    phaseInterval=setInterval(()=>{
        rem--; phaseTimerDisplay.innerText=rem>0?rem:'';
        if(rem<=0) clearInterval(phaseInterval);
    },1000);
}
const TRANSITION_MS=1200;
function setCircleState(state) {
    breathingCircle.classList.remove('idle','collapsed','active');
    if(state!=='idle') breathingCircle.classList.add(state);
}

// ── Flow ──────────────────────────────────────────────────────
async function runFlow() {
    if (!isRunning) return;
    const t=i18n[lang];
    const tIn=parseInt(times.inhale.value);
    if(tIn>0){
        breathText.innerText=t.inhaling;
        breathingCircle.style.transition=`transform ${tIn}s cubic-bezier(.4,0,.2,1),opacity ${tIn}s cubic-bezier(.4,0,.2,1),box-shadow ${tIn}s cubic-bezier(.4,0,.2,1)`;
        setCircleState('active'); playPhase(0); startPhaseCountdown(tIn);
        await new Promise(r=>currentPhaseTimeout=setTimeout(r,tIn*1000));
    }
    if(!isRunning) return;
    const tHF=parseInt(times.holdFull.value);
    if(tHF>0){
        breathText.innerText=t.holding; playPhase(1); startPhaseCountdown(tHF);
        await new Promise(r=>currentPhaseTimeout=setTimeout(r,tHF*1000));
    }
    if(!isRunning) return;
    const tOut=parseInt(times.exhale.value);
    if(tOut>0){
        breathText.innerText=t.exhaling;
        breathingCircle.style.transition=`transform ${tOut}s cubic-bezier(.4,0,.2,1),opacity ${tOut}s cubic-bezier(.4,0,.2,1),box-shadow ${tOut}s cubic-bezier(.4,0,.2,1)`;
        setCircleState('collapsed'); playPhase(2); startPhaseCountdown(tOut);
        await new Promise(r=>currentPhaseTimeout=setTimeout(r,tOut*1000));
    }
    if(!isRunning) return;
    const tHE=parseInt(times.holdEmpty.value);
    if(tHE>0){
        breathText.innerText=t.waiting; playPhase(3); startPhaseCountdown(tHE);
        await new Promise(r=>currentPhaseTimeout=setTimeout(r,tHE*1000));
    }
    if(isRunning){
        cycles++; cycleCounter.innerText=cycles;
        if(checkLimit()){ stopTimer(i18n[lang].limitMsg(limitType,limitValue)); return; }
        runFlow();
    }
}

// ── Start / Stop ──────────────────────────────────────────────
function startTimer() {
    _ensureAudioCtx();
    playStartSound();
    toggleInputs(true); startBtn.disabled=true;
    breathText.innerText=''; phaseTimerDisplay.innerText='';
    breathingCircle.style.transition=''; setCircleState('collapsed');
    document.querySelector('.container').classList.add('session');
    setTimeout(()=>{
        if(!startBtn.disabled) return;
        isRunning=true; totalSeconds=0; cycles=0;
        startBtn.disabled=false;
        startBtn.innerText=i18n[lang].stop;
        startBtn.style.background='linear-gradient(135deg,rgba(220,60,80,.6),rgba(180,30,50,.5))';
        startBtn.style.borderColor='rgba(220,100,100,.3)';
        sessionCounter.innerText='00:00'; cycleCounter.innerText='0';
        timerInterval=setInterval(()=>{
            totalSeconds++;
            sessionCounter.innerText=formatTime(totalSeconds);
            if(limitType==='minutes' && checkLimit()){ stopTimer(i18n[lang].limitMsg(limitType,limitValue)); }
        },1000);
        startTick();
        runFlow();
    },TRANSITION_MS);
}

function stopTimer(limitMsg) {
    isRunning=false;
    clearTimeout(currentPhaseTimeout); clearInterval(timerInterval); clearInterval(phaseInterval);
    stopTick();
    lastSession.innerText=`${formatTime(totalSeconds)} (${cycles})`;
    playStopTone();
    if(limitMsg) showToast(limitMsg);
    toggleInputs(true); startBtn.disabled=true;
    startBtn.innerText=i18n[lang].start;
    startBtn.style.background=''; startBtn.style.borderColor='';
    phaseTimerDisplay.innerText=''; breathText.innerText='';
    breathingCircle.style.transition=''; setCircleState('idle');
    document.querySelector('.container').classList.remove('session');
    setTimeout(()=>{
        breathText.innerText=i18n[lang].ready;
        toggleInputs(false); startBtn.disabled=false;
    },TRANSITION_MS);
}

startBtn.onclick = () => isRunning ? stopTimer() : startTimer();
resetBtn.onclick = () => {
    if(isRunning) return;
    times.inhale.value=4; times.holdFull.value=4;
    times.exhale.value=4; times.holdEmpty.value=4;
    setTechniqueLabel('Box Breathing');
};

// Reset inputs to defaults on every load — prevents browser session-restore
// from showing stale values that don't match the technique label
window.addEventListener('load', () => {
    times.inhale.value=4; times.holdFull.value=4;
    times.exhale.value=4; times.holdEmpty.value=4;
    setTechniqueLabel('Box Breathing');
});