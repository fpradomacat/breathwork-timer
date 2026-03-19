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

let isRunning=false, currentPhaseTimeout=null, timerInterval=null, phaseInterval=null;
let totalSeconds=0, cycles=0;

// ── Technique label ───────────────────────────────────────────
let activeTechniqueName = 'Box Breathing';

function setTechniqueLabel(name, isCustom = false) {
    if (!isCustom) activeTechniqueName = name;
    techniqueLabel.textContent = isCustom ? i18n[lang].custom : name;
    techniqueLabel.classList.toggle('is-custom', isCustom);
}

// ── Audio context ─────────────────────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, duration, vol) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'sine'; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
    osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + duration + 0.05);
}

function playHoverTick() {
    const vol = parseFloat(volSlider.value) * 0.06;
    if (vol <= 0) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'sine'; osc.frequency.value = 900;
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + 0.008);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.07);
    osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 0.08);
}

function playSelectChime() {
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

function playStopTone() {
    playTone(280, 1.2, parseFloat(volSlider.value) * 0.4);
}

volSlider.addEventListener('input', playVolumeTone);

document.getElementById('gear-dropdown').addEventListener('wheel', e => {
    if (!e.target.classList.contains('gear-vol-slider')) return;
    e.preventDefault(); e.stopPropagation();
    let v = parseFloat(volSlider.value) + (e.deltaY < 0 ? 0.1 : -0.1);
    volSlider.value = Math.min(1, Math.max(0, parseFloat(v.toFixed(1))));
    playVolumeTone();
}, { passive: false });

// Hover tick on interactive modal/dropdown elements
document.addEventListener('mouseover', e => {
    const el = e.target.closest('.preset-card, .sound-chip, .limit-chip, .ctrl-option, .modal-close');
    if (el) playHoverTick();
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
    renderSoundModal();
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

// ── Sounds ────────────────────────────────────────────────────
const SOUND_OPTIONS = [
    { labelEs:'Campana',  labelEn:'Bell',    file:'inhala.mp3'      },
    { labelEs:'Cuenco',   labelEn:'Bowl',    file:'sound_bowl.mp3'  },
    { labelEs:'Chime',    labelEn:'Chime',   file:'sound_chime.mp3' },
    { labelEs:'Silencio', labelEn:'Silence', file:null              },
];
let soundConfig = [0,0,0,0];
const phaseAudios = [
    new Audio('inhala.mp3'), new Audio('pausa_lleno.mp3'),
    new Audio('exhala.mp3'), new Audio('pausa_vacio.mp3'),
];

function renderSoundModal() {
    const grid = document.getElementById('sound-grid');
    grid.innerHTML = '';
    i18n[lang].soundPhases.forEach((name, pi) => {
        const section = document.createElement('div');
        section.className = 'sound-section';
        section.innerHTML = `<div class="sound-section-title">${name}</div>`;
        const opts = document.createElement('div');
        opts.className = 'sound-options';
        SOUND_OPTIONS.forEach((opt,oi) => {
            const chip = document.createElement('button');
            chip.className = 'sound-chip'+(soundConfig[pi]===oi?' active':'');
            chip.textContent = lang==='es' ? opt.labelEs : opt.labelEn;
            chip.addEventListener('click', () => { soundConfig[pi]=oi; renderSoundModal(); });
            opts.appendChild(chip);
        });
        section.appendChild(opts);
        grid.appendChild(section);
    });
}

document.getElementById('open-presets').addEventListener('click', () => {
    document.getElementById('gear-dropdown').classList.remove('open');
    renderPresets(); openModal('modal-presets');
});
document.getElementById('open-sounds').addEventListener('click', () => {
    document.getElementById('gear-dropdown').classList.remove('open');
    renderSoundModal(); openModal('modal-sounds');
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
    const opt = SOUND_OPTIONS[soundConfig[pi]];
    if (!opt || !opt.file) return;
    const a = phaseAudios[pi];
    a.pause(); a.currentTime = 0;
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
        runFlow();
    },TRANSITION_MS);
}

function stopTimer(limitMsg) {
    isRunning=false;
    clearTimeout(currentPhaseTimeout); clearInterval(timerInterval); clearInterval(phaseInterval);
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
        phaseAudios.forEach(a=>a.pause());
    },TRANSITION_MS);
}

startBtn.onclick = () => isRunning ? stopTimer() : startTimer();
resetBtn.onclick = () => {
    if(isRunning) return;
    times.inhale.value=4; times.holdFull.value=4;
    times.exhale.value=4; times.holdEmpty.value=4;
    setTechniqueLabel('Box Breathing');
};